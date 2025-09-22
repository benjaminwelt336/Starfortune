import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Lucide from "lucide-react";

/* =====================================================
 *  修复点摘要（不改变 UI / 交互 / 配置项）：

/* ============ LocalStorage helpers ============ */
const getLS = (k: string, d: string) => { try { const v = localStorage.getItem(k); return v ?? d; } catch (_e) { return d; } };
const setLS = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch (_e) {} };

/* ============ Date helpers ============ */
const pad2 = (n: number) => String(n).padStart(2, "0");
const formatLocal = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// 发送给 ALAPI：取“本地日期”，固定到当天 12:00:00，避免跨时区把日期推前/推后
function toApiDateTime(localDT?: string | Date) {
  if (localDT instanceof Date) {
    const y = localDT.getFullYear(), m = pad2(localDT.getMonth() + 1), day = pad2(localDT.getDate());
    return `${y}-${m}-${day} 12:00:00`;
  }
  const s = (typeof localDT === "string" && localDT) ? localDT : formatLocal(new Date());
  const [ymd] = s.split("T");
  return `${ymd} 12:00:00`;
}
function msToNextMidnight(from = new Date()) {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - from.getTime();
}

/* ============ Fallback / Dedup helpers ============ */
const NON_FALLBACK_STATUS = new Set([401, 403, 429]);
const FALLBACK_STATUS = new Set([404, 405, 415]);

function shouldFallbackHttp(status: number) {
  if (NON_FALLBACK_STATUS.has(status)) return false;
  if (FALLBACK_STATUS.has(status)) return true;
  if (status >= 500) return true;
  return false;
}

function toKey(obj: unknown) {
  // 稳定 key（避免无意义的字符串波动）
  try { return JSON.stringify(obj); } catch { return String(obj); }
}

/* ============ Icon safe wrappers ============ */
const IconCmp = ({ Comp, className = "" }: { Comp: any; className?: string }) => {
  if (!Comp) return null;
  const C = Comp as any;
  return <C className={className} />;
};
const ChevronIcon = ({ up = false, className = "" }: { up?: boolean; className?: string }) => {
  const Raw = (up ? (Lucide as any).ChevronUp : (Lucide as any).ChevronDown) as any;
  if (Raw) return <Raw className={className} />;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d={up ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
};

const { CalendarDays, Moon, Zap, Triangle, Settings, Sparkles, Heart, Briefcase, Wallet, Activity, Wand2 } = (Lucide as any);

/* ============ UI atoms ============ */
const SectionTitle = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2 text-slate-800">
      <div className="rounded-xl bg-white border p-2 shadow-sm">{Icon ? <Icon className="w-4 h-4" /> : null}</div>
      <div className="text-base md:text-lg font-semibold">{title}</div>
    </div>
  </div>
);
const Progress = ({ value }: { value: number }) => (
  <div className="h-2 w-full rounded-full bg-slate-100">
    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border bg-white/80 shadow-sm backdrop-blur p-4 md:p-6">{children}</div>
);

/* ============ Signs ============ */
const SIGNS: { value: string; label: string; symbol: string }[] = [
  { value: "aries", label: "白羊座", symbol: "♈" },
  { value: "taurus", label: "金牛座", symbol: "♉" },
  { value: "gemini", label: "双子座", symbol: "♊" },
  { value: "cancer", label: "巨蟹座", symbol: "♋" },
  { value: "leo", label: "狮子座", symbol: "♌" },
  { value: "virgo", label: "处女座", symbol: "♍" },
  { value: "libra", label: "天秤座", symbol: "♎" },
  { value: "scorpio", label: "天蝎座", symbol: "♏" },
  { value: "sagittarius", label: "射手座", symbol: "♐" },
  { value: "capricorn", label: "摩羯座", symbol: "♑" },
  { value: "aquarius", label: "水瓶座", symbol: "♒" },
  { value: "pisces", label: "双鱼座", symbol: "♓" },
];
const EN_SIGNS = SIGNS.map(s => s.value);
const ZH_TO_EN: Record<string, string> = Object.fromEntries(SIGNS.map(s => [s.label, s.value]));

const SignSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const cur = SIGNS.find(s => s.value === value) || SIGNS[0];
  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 bg-white"
      >
        <span className="text-slate-800 text-sm">{cur.symbol} {cur.label}</span>
        <ChevronIcon className={`w-4 h-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={popRef} className="absolute z-30 mt-2 w-44 max-h-80 overflow-auto rounded-xl border bg-white shadow-lg p-1">
          {SIGNS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => { onChange(s.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm ${
                s.value === value ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"
              }`}
            >
              <span className="truncate">{s.symbol} {s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ============ Main ============ */
export default function App() {
  const [page, setPage] = useState<"home" | "settings">("home");

  /* ALAPI */
  const ALAPI_DEFAULT_TOKEN = "hjp5u0tjjofehuytfmkjsfnfxgq1g8";
  const [alapiBase, setAlapiBase] = useState(() => getLS("alapi_base", "https://v3.alapi.cn"));
  const [alapiToken, setAlapiToken] = useState(() => getLS("alapi_token", ALAPI_DEFAULT_TOKEN));
  const [showAlapiToken, setShowAlapiToken] = useState(false);
  useEffect(() => setLS("alapi_base", alapiBase), [alapiBase]);
  useEffect(() => setLS("alapi_token", alapiToken), [alapiToken]);

  /* OpenAI */
  const OFFICIAL = {
    base: "https://api.siliconflow.cn/v1/chat/completions",
    key: "sk-rxlajixcihcvdqaajdvbkfsblqabesfjxknjztszfdnvkyze",
    model: "deepseek-ai/DeepSeek-V3.1",
  } as const;
  const [aiMode, setAiMode] = useState<"official" | "custom">(() => (getLS("ai_mode", "official") as any));
  const [aiBase, setAiBase] = useState(() => getLS("ai_base", OFFICIAL.base));
  const [openAIKey, setOpenAIKey] = useState(() => getLS("openai_key", OFFICIAL.key));
  const [openAIModel, setOpenAIModel] = useState(() => getLS("openai_model", OFFICIAL.model));
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  useEffect(() => setLS("ai_mode", aiMode), [aiMode]);
  useEffect(() => setLS("ai_base", aiBase), [aiBase]);
  useEffect(() => setLS("openai_key", openAIKey), [openAIKey]);
  useEffect(() => setLS("openai_model", openAIModel), [openAIModel]);

  const switchMode = (mode: "official" | "custom") => {
    if (mode === aiMode) return;
    setAiMode(mode);
    if (mode === "official") {
      setAiBase(OFFICIAL.base);
      setOpenAIKey(OFFICIAL.key);
      setOpenAIModel(OFFICIAL.model);
    } else {
      setAiBase("");
      setOpenAIKey("");
      setOpenAIModel("");
    }
  };

  /* Home states */
  const [dateTimeLocal, setDateTimeLocal] = useState(() => getLS("date_time", formatLocal(new Date())));
  const [sign, setSign] = useState(() => {
    const v = getLS("star_sign", "capricorn");
    if (!EN_SIGNS.includes(v)) return ZH_TO_EN[v as any] ?? "capricorn";
    return v;
  });
  const [starTab, setStarTab] = useState<"day" | "tomorrow" | "week" | "month" | "year">("day");
  const [expandAlmanac, setExpandAlmanac] = useState(false);
  const [showStarDetail, setShowStarDetail] = useState(false);

  useEffect(() => setLS("date_time", dateTimeLocal), [dateTimeLocal]);
  useEffect(() => setLS("star_sign", sign), [sign]);

  // 初始强制为系统时间；
  useEffect(() => {
    const now = formatLocal(new Date());
    setDateTimeLocal(now);
    setLS("date_time", now);
  }, []);
  useEffect(() => {
    const syncNow = () => {
      const now = formatLocal(new Date());
      setDateTimeLocal(now);
      setLS("date_time", now);
    };
    window.addEventListener("focus", syncNow);
    const onVis = () => { if (document.visibilityState === "visible") syncNow(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", syncNow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  /* ======== Almanac（POST 优先 + GET 回退，仅必要时） ======== */
  const almanacEndpoint = useMemo(
    () => `${alapiBase.replace(/\/$/, "")}/api/lunar`,
    [alapiBase]
  );

  // —— 新增：仅用于“每日黄历”的系统时间驱动日期（固定到本地 12:00:00）
  const [almanacDate12, setAlmanacDate12] = useState(() => toApiDateTime(new Date()));

  // —— 改为使用 almanacDate12（不再跟随 dateTimeLocal）
  const almanacBody = useMemo(
    () => ({ date: almanacDate12 }),
    [almanacDate12]
  );

  const [almanacLoading, setAlmanacLoading] = useState(false);
  const [almanacError, setAlmanacError] = useState<string | null>(null);
  const [almanacData, setAlmanacData] = useState<any>(null);

  // in-flight 去重：同 key 正在进行中时不再触发第二次
  const almanacInflightKeyRef = useRef<string | null>(null);

  const fetchAlmanac = async (reqKey: string) => {
    if (almanacInflightKeyRef.current === reqKey) return; // StrictMode 第二次执行直接跳过
    almanacInflightKeyRef.current = reqKey;

    setAlmanacLoading(true);
    setAlmanacError(null);

    const body = JSON.stringify(almanacBody); // { date: "YYYY-MM-DD 12:00:00" }
    const headers = {
      "Content-Type": "application/json",
      token: alapiToken || "",
    } as Record<string, string>;

    try {
      // ① 优先：官方推荐写法（POST + header token + JSON body）
      let res = await fetch(almanacEndpoint, { method: "POST", headers, body, cache: "no-store" });
      if (!res.ok) {
        // 仅在“有意义的失败”时回退
        if (shouldFallbackHttp(res.status)) {
          // ② 回退：GET + query（防 CORS / 代理），但对 401/403/429 不回退，避免叠加请求
          const u = new URL(almanacEndpoint);
          u.searchParams.set("date", (almanacBody as any).date);
          if (alapiToken) u.searchParams.set("token", alapiToken);
          const res2 = await fetch(u.toString(), { method: "GET", cache: "no-store" });
          if (!res2.ok) throw new Error(`GET ${res2.status} ${res2.statusText}`);
          const json2 = await res2.json();
          if (!(json2?.code === 200 || json2?.success === true)) {
            const msg = json2?.message || json2?.msg || "unexpected response";
            throw new Error(`GET payload: ${msg}`);
          }
          setAlmanacData(json2);
        } else {
          throw new Error(`POST ${res.status} ${res.statusText}`);
        }
      } else {
        const json = await res.json();
        if (json?.code === 200 || json?.success === true) {
          setAlmanacData(json);
        } else if (Number(json?.code) === 429) {
          setAlmanacError("API 限流，请稍后再试。");
          setAlmanacData(null);
        } else {
          // 非 200 但 HTTP 为 200，不回退，直接报错，避免重复请求
          const msg = json?.message || json?.msg || "unexpected response";
          throw new Error(`POST payload: ${msg}`);
        }
      }
    } catch (err: any) {
      setAlmanacError(err?.message || "请求失败");
      setAlmanacData(null);
    } finally {
      setAlmanacLoading(false);
      almanacInflightKeyRef.current = null;
    }
  };

  // 系统时间触发（打开 / 焦点 / 标签可见）使 almanacDate12 更新时间
  useEffect(() => {
    const syncAlmanacNow = () => setAlmanacDate12(toApiDateTime(new Date()));
    // 初始同步一次，确保刚打开就是最新
    syncAlmanacNow();

    window.addEventListener("focus", syncAlmanacNow);
    const onVis = () => { if (document.visibilityState === "visible") syncAlmanacNow(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", syncAlmanacNow);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // 跨越本地午夜后自动刷新一次
  useEffect(() => {
    let t: any;
    const schedule = () => {
      const ms = msToNextMidnight(new Date());
      t = setTimeout(() => {
        setAlmanacDate12(toApiDateTime(new Date())); // 触发最新请求
        schedule(); // 下一天
      }, ms + 500); // 缓冲避免边界抖动
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  const almanacReqKey = useMemo(
    () => toKey({ endpoint: almanacEndpoint, date: (almanacBody as any).date, hasToken: !!alapiToken }),
    [almanacEndpoint, almanacBody, alapiToken]
  );

  // 仅在 基址/Token/系统日期 变化时重拉（不再跟随 dateTimeLocal 或展开）
  useEffect(() => {
    fetchAlmanac(almanacReqKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almanacReqKey]);

  // 解析：宜/忌 + 农历/干支/五行 + 六曜（只认 six_star）
  const almanacParsed = useMemo(() => {
    try {
      const d: any = (almanacData?.data ?? almanacData) || {};

      const normList = (v: any): string[] => {
        if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
        if (typeof v === "string") {
          const seps = ["、", "\u2003", "，", ",", " "]; let s = v;
          for (const c of seps) s = s.split(c).join(" ");
          return s.split(" ").map(x => x.trim()).filter(Boolean);
        }
        return [];
      };

      const yiList = normList(d.yi ?? d.suit ?? d.suitable ?? d.jishen ?? d.good);
      const jiList = normList(d.ji ?? d.avoid ?? d.unsuitable ?? d.xiongsha ?? d.bad);

      // 六曜：six_star
      const asText = (v: any): string | null => {
        if (v == null) return null;
        if (typeof v === "number") return String(v);
        if (typeof v === "string") return v.trim() || null;
        return null;
      };
      const deepFindSixStar = (obj: any): string | null => {
        const seen = new Set<any>();
        const re = /^(six[_-]?star)$/i; // 仅匹配 six_star 系列
        const dfs = (o: any): string | null => {
          if (!o || typeof o !== "object" || seen.has(o)) return null;
          seen.add(o);
          for (const k of Object.keys(o)) {
            const v = o[k];
            if (re.test(k)) {
              const t = asText(v);
              if (t) return t;
              if (Array.isArray(v)) {
                const s = v.find(x => typeof x === "string" && x.trim());
                if (s) return (s as string).trim();
              }
              if (v && typeof v === "object") {
                const s2 = dfs(v);
                if (s2) return s2;
              }
            }
          }
          for (const k of Object.keys(o)) {
            const v = o[k];
            if (v && typeof v === "object") {
              const s = dfs(v);
              if (s) return s;
            }
          }
          return null;
        };
        return dfs(obj);
      };
      const six_star = (() => {
        const direct =
          asText(d.six_star) ??
          asText((d as any).sixStar) ??
          asText((d as any).sixstar) ??
          asText((d as any)["six-star"]);
        if (direct) return direct;
        const deep = deepFindSixStar(d);
        return deep || null;
      })();

      // 农历（你给的字段：*_chinese）
      const nongli = (() => {
        const y = (d.lunar_year_chinese ?? d.lunar_year_cn ?? d.lunar_year) as string | undefined;
        const m = (d.lunar_month_chinese ?? d.lunar_month_cn ?? d.lunar_month) as string | undefined;
        const day = (d.lunar_day_chinese ?? d.lunar_day_cn ?? d.lunar_day) as string | undefined;
        const y2 = (typeof y === "string" && y.trim()) ? y.trim() : "";
        const m2 = (typeof m === "string" && m.trim()) ? m.trim() : "";
        const d2 = (typeof day === "string" && day.trim()) ? day.trim() : "";
        if (y2 || m2 || d2) return `${y2}${y2 ? "年" : ""}${m2}${m2 ? "月" : ""}${d2}`;
        const legacy = [d.lunar, d.nongli, d.lunar_calendar, d.lunar_text, d.lunar_cn].find(
          v => typeof v === "string" && (v as string).trim()
        );
        return (legacy as string | undefined)?.trim() ?? null;
      })();

      // 干支（ganzhi_year/month/day）
      const ganzhi = (() => {
        const y = (d.ganzhi_year as string) || "";
        const m = (d.ganzhi_month as string) || "";
        const day = (d.ganzhi_day as string) || "";
        const parts = [y, m, day].map(s => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
        if (parts.length) return parts.join(" ");
        const legacy = [d.ganzhi, d.gz, d.tiangan_dizhi].find(v => typeof v === "string" && (v as string).trim());
        return (legacy as string | undefined)?.trim() ?? null;
      })();

      // 五行（优先“日五行”，再用年/月/时）
      const wuxing = (
        (typeof d.wuxing_day === "string" && d.wuxing_day.trim()) ? d.wuxing_day.trim() :
        (typeof d.wuxing_year === "string" && d.wuxing_year.trim()) ? d.wuxing_year.trim() :
        (typeof d.wuxing_month === "string" && d.wuxing_month.trim()) ? d.wuxing_month.trim() :
        (typeof d.wuxing_hour === "string" && d.wuxing_hour.trim()) ? d.wuxing_hour.trim() :
        (typeof d.wuxing === "string" && d.wuxing.trim()) ? d.wuxing.trim() :
        (typeof d.five_elements === "string" && d.five_elements.trim()) ? d.five_elements.trim() :
        null
      );

      return {
        yiList, jiList, yCount: yiList.length, jCount: jiList.length,
        six_star,
        caishen: d.caishen, caishen_desc: d.caishen_desc,
        fushen: d.fushen, fushen_desc: d.fushen_desc,
        xishen: d.xishen, xishen_desc: d.xishen_desc,
        taishen: d.taishen, shou: d.shou,
        xiu: d.xiu, xiu_animal: d.xiu_animal, xiu_luck: d.xiu_luck,
        nongli, ganzhi, wuxing,
      };
    } catch (_e) {
      return { yiList: [], jiList: [], yCount: 0, jCount: 0, six_star: "", nongli: null, ganzhi: null, wuxing: null } as any;
    }
  }, [almanacData]);

  /* ======== Star：补传 token + 必要时回退 + 请求去重 ======== */
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [starData, setStarData] = useState<any>(null);
  const starAbortRef = useRef<AbortController | null>(null);
  const starInflightKeyRef = useRef<string | null>(null);

  const fetchStar = async (reqKey: string, starOverride?: string, typeOverride?: string) => {
    if (starInflightKeyRef.current === reqKey) return; // StrictMode 二次触发去重
    starInflightKeyRef.current = reqKey;

    try {
      if (starAbortRef.current) starAbortRef.current.abort();
      const controller = new AbortController();
      starAbortRef.current = controller;

      setStarLoading(true);
      setStarError(null);

      const starRaw = starOverride ?? sign;
      const starParam = EN_SIGNS.includes(starRaw) ? starRaw : ZH_TO_EN[starRaw as any] ?? "capricorn";
      const typeParam = typeOverride ?? "all";
      const dateParam = toApiDateTime(dateTimeLocal);

      // ① 优先走同源函数 /api/star（Vercel/Electron）
      const u1 = new URL("/api/star", window.location.origin);
      u1.searchParams.set("star", starParam);
      u1.searchParams.set("type", typeParam);
      u1.searchParams.set("date", dateParam);
      if (alapiToken) u1.searchParams.set("token", alapiToken); // 关键：传 token
      u1.searchParams.set("_ts", Date.now().toString());

      let res = await fetch(u1.toString(), { cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        if (shouldFallbackHttp(res.status)) {
          // ② 回退到直连 ALAPI（以防本地没有 /api/star 路由）
          const base = alapiBase.endsWith("/") ? alapiBase : alapiBase + "/";
          const u2 = new URL("/api/star", base);
          u2.searchParams.set("star", starParam);
          u2.searchParams.set("type", typeParam);
          u2.searchParams.set("date", dateParam);
          if (alapiToken) u2.searchParams.set("token", alapiToken);
          u2.searchParams.set("_ts", Date.now().toString());
          res = await fetch(u2.toString(), { cache: "no-store", signal: controller.signal });
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        } else {
          throw new Error(`${res.status} ${res.statusText}`);
        }
      }

      const json = await res.json();
      // 不再对 429 再次回退请求
      if (Number(json?.code) === 429) {
        setStarError("系统繁忙，请稍后再试。");
        setStarData(null);
      } else {
        setStarData(json);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStarError(e?.message || String(e));
      setStarData(null);
    } finally {
      setStarLoading(false);
      starInflightKeyRef.current = null;
    }
  };

  const starReqKey = useMemo(
    () => toKey({ base: alapiBase, token: !!alapiToken, sign: sign, date: toApiDateTime(dateTimeLocal) }),
    [alapiBase, alapiToken, sign, dateTimeLocal]
  );

  useEffect(() => {
    fetchStar(starReqKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starReqKey]);

  const sliceByTab = (raw: any, tab: string) => {
    const d: any = (raw?.data ?? raw) || {};
    const maybe = d && typeof d === "object" ? d[tab] : null;
    return maybe && typeof maybe === "object" ? maybe : d;
  };
  const starSlice = useMemo(() => sliceByTab(starData, starTab), [starData, starTab]);

  const toNum = (v: any) => {
    if (v == null) return null;
    if (typeof v === "string") {
      const s = v.trim().replace(/%$/, "");
      const n = parseFloat(s);
      if (!isNaN(n)) return toNum(n);
      return null;
    }
    let n = Number(v);
    if (isNaN(n)) return null;
    if (n > 0 && n <= 1) n = n * 100;
    else if (n > 1 && n <= 5 && Number.isInteger(n)) n = n * 20;
    return Math.max(0, Math.min(100, n));
  };
  const pickStarScores = (data: any) => {
    try {
      const d: any = (data?.data ?? data) || {};
      const o = toNum(d.all ?? d.overall ?? d.comprehensive ?? d.summary_index ?? d.index ?? d.all_rate);
      const w = toNum(d.work ?? d.career ?? d.work_rate ?? d.career_index);
      const l = toNum(d.love ?? d.emotion ?? d.love_rate ?? d.emotion_index);
      const f = toNum(d.money ?? d.finance ?? d.wealth ?? d.fortune ?? d.finance_index);
      const h = toNum(d.health ?? d.health_index);
      const out = [
        { key: "综合", val: o, icon: Zap },
        { key: "工作", val: w, icon: Briefcase },
        { key: "爱情", val: l, icon: Heart },
        { key: "财富", val: f, icon: Wallet },
        { key: "健康", val: h, icon: Activity },
      ].filter(x => x.val != null) as { key: string; val: number; icon: any }[];
      return out.length ? out : null;
    } catch (_e) { return null; }
  };
  const starScores = useMemo(
    () => pickStarScores(starSlice) ?? [
      { key: "综合", val: 90, icon: Zap },
      { key: "工作", val: 90, icon: Briefcase },
      { key: "爱情", val: 91, icon: Heart },
      { key: "财富", val: 93, icon: Wallet },
      { key: "健康", val: 92, icon: Activity },
    ],
    [starSlice]
  );

  const pickStarSummary = (data: any): string | null => {
    try {
      const d: any = (data?.data ?? data) || {};
      if (typeof d.notice === "string" && d.notice.trim()) return d.notice.trim();
      for (const k of ["summary", "overall", "zh", "zhonghe", "general", "index", "desc", "conclusion"]) {
        const v = d[k]; if (typeof v === "string" && v.trim()) return v.trim();
      }
      if (typeof d.all_text === "string" && d.all_text.trim()) return d.all_text.trim();
      return null;
    } catch (_e) { return null; }
  };
  const starSummaryFromApi = useMemo(() => pickStarSummary(starSlice), [starSlice]);

  const pickLuckyBits = (data: any) => {
    try {
      const d: any = (data?.data ?? data) || {};
      const norm = (v: any) => {
        if (v == null) return null;
        const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : String(v);
        return s || null;
      };
      return { star: norm(d.lucky_star), color: norm(d.lucky_color), number: norm(d.lucky_number) };
    } catch (_e) { return { star: null, color: null, number: null }; }
  };
  const luckyBits = useMemo(() => pickLuckyBits(starSlice), [starSlice]);

  const displayDate = useMemo(() => {
    try {
      const d: any = (starData?.data ?? starData) || {};
      const fromSlice = d && d[starTab] && typeof d[starTab].date === "string" ? d[starTab].date.trim() : null;
      if (fromSlice) return fromSlice;
      const top = typeof d.date === "string" ? d.date.trim() : null;
      return top || dateTimeLocal.slice(0, 10);
    } catch (_e) { return dateTimeLocal.slice(0, 10); }
  }, [starData, starTab, dateTimeLocal]);

  /* ======== AI 今日建议 ======== */
  const [advLoading, setAdvLoading] = useState(false);
  const [advice, setAdvice] = useState<string>("");

  const advicePrompt = useMemo(() => {
    const signZh = (SIGNS.find(s => s.value === sign)?.label) || sign;
    const tabZh: Record<string, string> = { day: "今日", tomorrow: "明日", week: "本周", month: "本月", year: "全年" };
    const summary = starSummaryFromApi || "（暂无概览）";
    const scoresStr = (starScores || []).map(s => `${s.key}${s.val}%`).join("，");
    const lucky = [
      luckyBits.star ? `幸运星：${luckyBits.star}` : null,
      luckyBits.color ? `幸运色：${luckyBits.color}` : null,
      luckyBits.number ? `幸运数：${luckyBits.number}` : null,
    ].filter(Boolean).join("，");
    const yi = (almanacParsed?.yiList || []).slice(0, 10).join("、") || "无";
    const ji = (almanacParsed?.jiList || []).slice(0, 10).join("、") || "无";
    return `请基于以下信息用中文给出3-5条当日可执行建议（编号列表），每条不超过50字。\n日期：${displayDate}\n星座：${signZh} (${sign})，类型：${tabZh[starTab]}\n星座概览：${summary}\n评分：${scoresStr}\n${lucky ? `幸运提示：${lucky}\n` : ""}黄历宜：${yi}\n黄历忌：${ji}`;
  }, [displayDate, sign, starTab, starSummaryFromApi, starScores, luckyBits, almanacParsed]);

  // 去重 key：同一 prompt + 模型配置不重复调用
  const adviceInflightKeyRef = useRef<string | null>(null);
  const adviceReqKey = useMemo(
    () => toKey({ prompt: advicePrompt, base: aiBase, key: !!openAIKey, model: openAIModel }),
    [advicePrompt, aiBase, openAIKey, openAIModel]
  );

  async function runAdvice() {
    if (!aiBase || !openAIKey || !openAIModel) {
      setAdvice("请先在设置页填写 API 地址、秘钥和模型。");
      return;
    }
    if (adviceInflightKeyRef.current === adviceReqKey) return; // 去重
    adviceInflightKeyRef.current = adviceReqKey;

    try {
      setAdvLoading(true);
      const res = await fetch(aiBase, {
        method: "POST",
        headers: { "Authorization": `Bearer ${openAIKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: openAIModel, temperature: 0.7, stream: false,
          messages: [
            { role: "system", content: "你是一个中文效率助手，基于用户提供的信息给出理性、可执行的当日建议，使用简洁编号列表，每条不超过50字。" },
            { role: "user", content: advicePrompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      const txt = data?.choices?.[0]?.message?.content?.trim() || "";
      setAdvice(txt || "（无内容返回）");
    } catch (e: any) {
      setAdvice(`生成失败：${e?.message || String(e)}`);
    } finally {
      setAdvLoading(false);
      adviceInflightKeyRef.current = null;
    }
  }

  // 仅当 两端数据就绪 且 不在加载中 时自动生成，避免重复触发
  useEffect(() => {
    const haveStar = !!starData && !starLoading;
    const haveAlmanac = !!almanacData && !almanacLoading;
    if (!haveStar || !haveAlmanac) return;
    runAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adviceReqKey, starData, almanacData, starLoading, almanacLoading]);

  /* ========== UI ========== */
  const Home = (
    <div className="space-y-6">
      {/* 每日黄历 */}
      <Card>
        <SectionTitle icon={CalendarDays} title="每日黄历" />

        {/* 顶部：日期 + 农历/干支/五行 */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm mb-3">
          <input
            type="datetime-local"
            value={dateTimeLocal}
            onChange={(e) => setDateTimeLocal(e.target.value)}
            className="rounded-xl border px-3 py-2 bg-white"
          />
          {almanacParsed?.nongli && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
              农历：{almanacParsed.nongli}
            </span>
          )}
          {almanacParsed?.ganzhi && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
              干支：{almanacParsed.ganzhi}
            </span>
          )}
          {almanacParsed?.wuxing && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700">
              五行：{almanacParsed.wuxing}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 吉神 */}
          <div className="rounded-2xl border p-4 bg-gradient-to-br from-sky-100 to-amber-100">
            <div className="text-slate-500/60 text-sm">吉神</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{almanacParsed.yCount}</div>
          </div>
          {/* 凶神 */}
          <div className="rounded-2xl border p-4 bg-gradient-to-br from-rose-100 to-amber-100">
            <div className="text-slate-500/60 text-sm">凶神</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{almanacParsed.jCount}</div>
          </div>
          {/* 六曜（six_star） */}
          <div className="rounded-2xl border p-4 bg-gradient-to-br from-violet-100 to-teal-100">
            <div className="text-slate-500/60 text-sm">六曜</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{almanacParsed.six_star || "—"}</div>
          </div>

          {/* 宜 */}
          <div className="rounded-2xl border p-4 bg-emerald-50/50 md:col-span-3 md:col-start-1">
            <div className="mb-2"><span className="chip yi">宜</span></div>
            <div className="flex flex-wrap gap-2.5">
              {(almanacParsed.yiList || []).map((x, i) => (
                <span key={i} className="pastel-badge" style={{ ["--c" as any]: "#10b981" } as any}>{x}</span>
              ))}
            </div>
          </div>

          {/* 忌 */}
          <div className="rounded-2xl border p-4 bg-rose-50/50 md:col-span-3 md:col-start-1">
            <div className="mb-2"><span className="chip ji">忌</span></div>
            <div className="flex flex-wrap gap-2.5">
              {(almanacParsed.jiList || []).map((x, i) => (
                <span key={i} className="pastel-badge" style={{ ["--c" as any]: "#ef4444" } as any}>{x}</span>
              ))}
            </div>
          </div>
        </div>

        <button onClick={() => setExpandAlmanac((s) => !s)} className="mt-3 inline-flex items-center gap-1 text-sm text-slate-600">
          {expandAlmanac ? (<><ChevronIcon up className="w-4 h-4" /> 收起</>) : (<><ChevronIcon className="w-4 h-4" /> 显示更多</>)}
        </button>
        {expandAlmanac && (
          <div className="mt-3 text-sm text-slate-700">
            {almanacLoading ? (
              <div className="text-slate-500">正在拉取…</div>
            ) : almanacError ? (
              <div className="text-rose-600">请求失败：{almanacError}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>财神方位：{almanacParsed?.caishen_desc}（{almanacParsed?.caishen}）</div>
                <div>福神方位：{almanacParsed?.fushen_desc}（{almanacParsed?.fushen}）</div>
                <div>喜神方位：{almanacParsed?.xishen_desc}（{almanacParsed?.xishen}）</div>
                <div>胎神占方：{almanacParsed?.taishen}</div>
                <div>值日：{almanacParsed?.shou}</div>
                <div>宿：{almanacParsed?.xiu}（{almanacParsed?.xiu_animal}/{almanacParsed?.xiu_luck}）</div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 每日星座 */}
      <Card>
        <SectionTitle icon={Moon} title="每日星座" />
        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm mb-3">
          <SignSelect value={sign} onChange={(v) => setSign(v)} />
          <div className="rounded-xl border px-3 py-1.5 bg-white text-slate-600">{displayDate}</div>
          <div className="flex items-center gap-2">
            {[['day', '今日'], ['tomorrow', '明日'], ['week', '本周'], ['month', '本月'], ['year', '全年']].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStarTab(k as any)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  starTab === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {luckyBits.star && <span className="grad-pill text-slate-700" style={{ ["--from" as any]: "#F9FAFB", ["--to" as any]: "#F3F4F6" } as any}>幸运星：{luckyBits.star}</span>}
            {luckyBits.color && <span className="grad-pill text-slate-700" style={{ ["--from" as any]: "#F9FAFB", ["--to" as any]: "#F1F5F9" } as any}>幸运色：{luckyBits.color}</span>}
            {luckyBits.number && <span className="grad-pill text-slate-700" style={{ ["--from" as any]: "#F8FAFC", ["--to" as any]: "#EEF2F7" } as any}>幸运数：{luckyBits.number}</span>}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {starScores.map((s, i) => (
            <div key={i} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <IconCmp Comp={s.icon} className="w-4 h-4" />
                  {s.key}
                </div>
                <div className="text-slate-500 text-sm">{s.val}%</div>
              </div>
              <Progress value={s.val} />
            </div>
          ))}
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-3 text-sm text-slate-700">
          <div>要点：{starSummaryFromApi || "—"}</div>
          <div className="text-slate-600">
            宜：{(starSlice?.yi ?? starSlice?.lucky ?? "—") || "—"}　　忌：{(starSlice?.ji ?? starSlice?.avoid ?? "—") || "—"}
          </div>
        </div>

        <div className="mt-3">
          <button onClick={() => setShowStarDetail((s) => !s)} className="inline-flex items-center gap-1 text-sm text-slate-600">
            <span>详细解读</span><ChevronIcon className={`w-4 h-4 transition-transform ${showStarDetail ? "rotate-180" : ""}`} />
          </button>
          {showStarDetail && (
            <div className="mt-2 text-sm text-slate-700 leading-7">
              {starLoading ? (
                <div className="text-slate-500">正在拉取…</div>
              ) : starError ? (
                <div className="text-rose-600">请求失败：{starError}</div>
              ) : (
                <>
                  {["all_text", "work_text", "love_text", "money_text", "health_text"].every((k) => !starSlice?.[k]) ? (
                    <p className="text-slate-500">暂无详细解读</p>
                  ) : (
                    <>
                      {starSlice?.all_text && (
                        <div className="mb-4">
                          <div className="flex items中心 gap-2 font-medium text-slate-800">
                            <IconCmp Comp={Zap} className="w-4 h-4" /> 综合
                          </div>
                          <p className="mt-1">{starSlice.all_text}</p>
                        </div>
                      )}
                      {starSlice?.work_text && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <IconCmp Comp={Briefcase} className="w-4 h-4" /> 工作
                          </div>
                          <p className="mt-1">{starSlice.work_text}</p>
                        </div>
                      )}
                      {starSlice?.love_text && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <IconCmp Comp={Heart} className="w-4 h-4" /> 爱情
                          </div>
                          <p className="mt-1">{starSlice.love_text}</p>
                        </div>
                      )}
                      {starSlice?.money_text && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <IconCmp Comp={Wallet} className="w-4 h-4" /> 财富
                          </div>
                          <p className="mt-1">{starSlice.money_text}</p>
                        </div>
                      )}
                      {starSlice?.health_text && (
                        <div className="mb-2">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <IconCmp Comp={Activity} className="w-4 h-4" /> 健康
                          </div>
                          <p className="mt-1">{starSlice.health_text}</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* OpenAI · 今日建议 */}
      <Card>
        <SectionTitle icon={Wand2} title="OpenAI · 今日建议" />
        {advLoading ? (
          <div className="text-sm text-slate-500">生成中…</div>
        ) : (
          advice ? (
            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{advice}</div>
          ) : (
            <div className="text-sm text-slate-500">填写 API 地址与 API 秘钥后自动生成（或点击下方按钮）。</div>
          )
        )}
        <div className="pt-2">
          <button onClick={()=>runAdvice()} className="rounded-xl px-3 py-1.5 text-sm border bg白色 hover:bg-slate-50 disabled:opacity-60" disabled={advLoading}>
            手动生成
          </button>
        </div>
      </Card>
    </div>
  );

  const SettingsPage = (
    <div className="space-y-6">
      <Card>
        <SectionTitle icon={Triangle} title="ALAPI 设置" />
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">ALAPI 基址</div>
            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={alapiBase} onChange={(e) => setAlapiBase(e.target.value)} placeholder="https://v3.alapi.cn" />
          </label>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">ALAPI Token</div>
            <div className="flex items-center gap-2">
              <input className="w-full rounded-xl border px-3 py-2 bg-white" type={showAlapiToken ? "text" : "password"} value={alapiToken} onChange={(e) => setAlapiToken(e.target.value)} placeholder="你的 token" />
              <button type="button" onClick={() => setShowAlapiToken(s => !s)} className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-slate-50">
                {showAlapiToken ? "隐藏" : "显示"}
              </button>
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Wand2} title="OpenAI 设置" />
        <div className="mb-3 flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="aimode" checked={aiMode === "official"} onChange={() => switchMode("official")} />
            官方
          </label>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">API地址</div>
            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={aiBase} onChange={(e) => setAiBase(e.target.value)} placeholder="https://api.siliconflow.cn/v1/chat/completions" />
          </label>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">API秘钥</div>
            <div className="flex items-center gap-2">
              <input className="w-full rounded-xl border px-3 py-2 bg-white" type={showOpenAIKey ? "text" : "password"} value={openAIKey} onChange={(e) => setOpenAIKey(e.target.value)} placeholder="sk-..." />
              <button type="button" onClick={() => setShowOpenAIKey(s => !s)} className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-slate-50">
                {showOpenAIKey ? "隐藏" : "显示"}
              </button>
            </div>
          </label>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">模型设置</div>
            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={openAIModel} onChange={(e) => setOpenAIModel(e.target.value)} placeholder="deepseek-ai/DeepSeek-V3.1" />
          </label>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">提示：官方模式自动使用固定配置；自定义会清空三项。</div>
        <button
          onClick={() => {
            setAlapiBase("https://v3.alapi.cn");
            setAlapiToken(ALAPI_DEFAULT_TOKEN);
            setShowAlapiToken(false);
            setAiMode("official");
            setAiBase(OFFICIAL.base);
            setOpenAIKey(OFFICIAL.key);
            setOpenAIModel(OFFICIAL.model);
            setShowOpenAIKey(false);
            setDateTimeLocal(formatLocal(new Date()));
            setSign("capricorn");
            setStarTab("day");
            setExpandAlmanac(false);
            setShowStarDetail(false);
          }}
          className="rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50"
        >
          重置
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-indigo-50 via-sky-50 to-emerald-50">
      {/* 局部样式：标签与“宜/忌”圆形徽章 */}
      <style>{`
        .pastel-badge{
          --c:#10b981;
          display:inline-flex; align-items:center;
          padding:4px 10px; border-radius:9999px;
          font-weight:400; font-size:13px;
          color:var(--c); background:#fff;
          border:1.25px solid color-mix(in srgb, var(--c) 65%, transparent);
          box-shadow:0 1px 0 rgba(0,0,0,.02) inset;
        }
        .chip{
          display:inline-flex; align-items:center; justify-content:center;
          width:40px; height:40px; padding:0; border-radius:9999px;
          background:#fff; border:1.5px solid #fff;
          color:var(--chip-c); font-weight:700; font-size:16px;
          box-shadow:0 1px 0 rgba(0,0,0,.03) inset;
        }
        .chip.yi{ --chip-c:#059669; }
        .chip.ji{ --chip-c:#e11d48; }
        .grad-pill{
          display:inline-flex; align-items:center;
          padding:6px 14px; border-radius:9999px;
          font-weight:600; font-size:14px;
          background:linear-gradient(90deg,var(--from),var(--to));
          border:1px solid rgba(0,0,0,.05);
          box-shadow:0 1px 0 rgba(255,255,255,.7) inset;
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/70 border p-2 shadow-sm">
              <IconCmp Comp={Sparkles} className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-xl font-bold leading-tight">星运通</div>
              <div className="text-xs text-slate-500">日日皆宜 Fortune favors every day</div>
            </div>
          </div>
          <button
            onClick={() => setPage(page === "home" ? "settings" : "home")}
            className="rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50 inline-flex items-center gap-2"
          >
            <IconCmp Comp={Settings} className="w-4 h-4" />
            {page === "home" ? "设置" : "返回首页"}
          </button>
        </div>

        {page === "home" ? Home : SettingsPage}
      </div>
    </div>
  );
}

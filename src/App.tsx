import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Lucide from "lucide-react";

// 星运通 · 首页 + 设置（预览运行）
// ——稳定版：修复括号/标签配对；支持外部星座SVG包（解压到 /public/star-icons）并自动回退

// ===== Icon helpers =====
const IconCmp = ({ Comp, className = "" }: { Comp: any; className?: string }) => {
  if (!Comp) return null; // 没有就不显示图标
  const C = Comp as any;
  return <C className={className} />;
};
const ChevronIcon = ({ up = false, className = "" }: { up?: boolean; className?: string }) => {
  const Raw = (up ? (Lucide as any).ChevronUp : (Lucide as any).ChevronDown) as any;
  if (Raw) return <Raw className={className} />; // 直接使用 lucide 组件
  // 兜底：只有 chevron 使用内联 svg，其他不再显示“时钟”类占位
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d={up ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
};
// 常用图标（运行时存在性检查，避免 undefined 触发 React#130）
const { CalendarDays, Sun, Settings, Sparkles, Heart, Briefcase, Wallet, Activity, Wand2 } = (Lucide as any);

// ===== Decorative SVG for stat cards =====
const DecoGood = (props: any) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="32" cy="32" r="13" />
    <path d="M32 12v8M32 44v8M12 32h8M44 32h8" />
    <path d="M21 21l4 4M39 39l4 4M43 21l-4 4M21 43l4-4" />
  </svg>
);
const DecoBad = (props: any) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M36 6L26 28h10L22 58l8-24H20L30 6z" />
    <circle cx="48" cy="50" r="10" />
    <path d="M42 50h12M48 44v12" />
  </svg>
);
const DecoSix = (props: any) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="32" cy="32" r="14" />
    {[0, 60, 120, 180, 240, 300].map((a, i) => {
      const r = 20;
      const cx = 32 + Math.cos((a * Math.PI) / 180) * r;
      const cy = 32 + Math.sin((a * Math.PI) / 180) * r;
      return <circle key={i} cx={cx} cy={cy} r="3" />;
    })}
  </svg>
);

export default function StarfortuneFullPreview() {
  // ===== Constants =====
  const yiColors = ["#F59E0B", "#34D399", "#60A5FA", "#10B981", "#A78BFA", "#F472B6", "#22D3EE", "#84CC16", "#FDE047"];
  const jiColors = ["#F87171", "#FB7185", "#FB923C", "#F43F5E", "#F59E0B", "#EF4444", "#F97316", "#E879F9"];
  const luckyGrad = {
    star: ["#F9FAFB", "#F3F4F6"],
    color: ["#F9FAFB", "#F1F5F9"],
    number: ["#F8FAFC", "#EEF2F7"],
  } as const;

  // ===== LocalStorage helpers =====
  const getLS = (k: string, d: string) => {
    try {
      const v = localStorage.getItem(k);
      return v ?? d;
    } catch {
      return d;
    }
  };
  const setLS = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };

  // ===== Routing =====
  const [page, setPage] = useState<"home" | "settings">("home");

  // ===== ALAPI =====
  const ALAPI_DEFAULT_TOKEN = "hjp5u0tjjofehuytfmkjsfnfxgq1g8";
  const [alapiBase, setAlapiBase] = useState(() => getLS("alapi_base", "https://v3.alapi.cn"));
  const [alapiToken, setAlapiToken] = useState(() => getLS("alapi_token", ALAPI_DEFAULT_TOKEN));
  const [showAlapiToken, setShowAlapiToken] = useState(false);

  // ===== OpenAI 设置（官方/自定义） =====
  const OFFICIAL = {
    base: "https://api.siliconflow.cn/v1/chat/completions",
    key: "sk-sarbhjodkolnuwdrzfkzkziemxwbvtfocevjwguhwtlyneyh",
    model: "deepseek-ai/DeepSeek-V3.1",
  } as const;
  const [aiMode, setAiMode] = useState<"official" | "custom">(() => (getLS("ai_mode", "official") as any));
  const [aiBase, setAiBase] = useState(() => getLS("ai_base", OFFICIAL.base));
  const [openAIKey, setOpenAIKey] = useState(() => getLS("openai_key", OFFICIAL.key));
  const [openAIModel, setOpenAIModel] = useState(() => getLS("openai_model", OFFICIAL.model));
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);

  // 外部星座图标目录（默认尝试 /star-icons，若不存在将自动回退到内置字形SVG）
  // （已移除星座图标目录配置）

  useEffect(() => setLS("alapi_base", alapiBase), [alapiBase]);
  useEffect(() => setLS("alapi_token", alapiToken), [alapiToken]);
  useEffect(() => setLS("ai_mode", aiMode), [aiMode]);
  useEffect(() => setLS("ai_base", aiBase), [aiBase]);
  useEffect(() => setLS("openai_key", openAIKey), [openAIKey]);
  useEffect(() => setLS("openai_model", openAIModel), [openAIModel]);
  // （已移除 star_icon_base 持久化）

  // ===== Home state =====
  const [dateTimeLocal, setDateTimeLocal] = useState(() => getLS("date_time", new Date().toISOString().slice(0, 16)));
  const [sign, setSign] = useState(() => getLS("star_sign", "capricorn"));
  const [starTab, setStarTab] = useState<"day" | "tomorrow" | "week" | "month" | "year">("day");
  const [expandAlmanac, setExpandAlmanac] = useState(false);
  const [showStarDetail, setShowStarDetail] = useState(false);

  // ===== Almanac fetch state =====
  const [almanacLoading, setAlmanacLoading] = useState(false);
  const [almanacError, setAlmanacError] = useState<string | null>(null);
  const [almanacData, setAlmanacData] = useState<any>(null);

  // ===== Star fetch state =====
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [starData, setStarData] = useState<any>(null);
  const starAbortRef = useRef<AbortController | null>(null);

  // ===== Sign list =====
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
  const EN_SIGNS = SIGNS.map((s) => s.value);
  const ZH_TO_EN: Record<string, string> = Object.fromEntries(SIGNS.map((s) => [s.label, s.value]));
  useEffect(() => {
    if (!EN_SIGNS.includes(sign)) {
      const mapped = ZH_TO_EN[sign as any];
      if (mapped) {
        setSign(mapped);
        setLS("star_sign", mapped);
      } else {
        setSign("capricorn");
        setLS("star_sign", "capricorn");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Examples (fallback) =====
  const exampleAlmanac = {
    lunar: "农历：二〇二五年九月十二",
    ganzhi: "干支：乙巳年 乙酉月 癸酉日",
    wuxing: "五行：水土",
    jishen: ["祭祀", "立碑", "纳财", "安床", "除服", "作灶", "修坟祭祀"],
    xiongsha: ["动土", "栽种", "移徙", "嫁娶"],
    yCount: 7,
    jCount: 6,
    youyin: "友引 · 六曜",
  };
  const exampleStar = {
    summary: "要点：得到贵人的助力。",
    scores: [
      { key: "综合", val: 90, icon: Sparkles },
      { key: "工作", val: 90, icon: Briefcase },
      { key: "爱情", val: 91, icon: Heart },
      { key: "财富", val: 93, icon: Wallet },
      { key: "健康", val: 92, icon: Activity },
    ],
    detail: [
      "事业：今日沟通顺畅，适合推进跨部门协作，避免在细节上反复拉扯。",
      "爱情：表达欲望增强，注意倾听对方需求，减少‘自我中心’判断。",
      "财富：适合复盘账目与预算，谨慎面对非刚需的消费与高风险投资。",
      "健康：关注肩颈与作息规律，保持水分补给，午后避免长时间久坐。",
    ],
  };
  const exampleAdvice = [
    "适合整理财务及文书事务，可安排精简计划或整理合同文件，今日运佳。",
    "工作中主动沟通问题，明确目标与分工，推动项目进度效率更高。",
    "与伴侣或重要协作者约定解决冲突方案，保持对关键话题的理性聚焦。",
  ];

  useEffect(() => setLS("date_time", dateTimeLocal), [dateTimeLocal]);
  useEffect(() => setLS("star_sign", sign), [sign]);

  // 午夜自动刷新
  useEffect(() => {
    const msToMidnight = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(24, 0, 0, 0);
      return next.getTime() - now.getTime();
    };
    const t = setTimeout(() => setDateTimeLocal(new Date().toISOString().slice(0, 16)), msToMidnight());
    return () => clearTimeout(t);
  }, []);

  // 顶部日期（优先当前标签内的 date）
  function pickStarDate(raw: any, tab: string) {
    try {
      const d: any = (raw?.data ?? raw) || {};
      const fromSlice = d && d[tab] && typeof d[tab].date === "string" ? d[tab].date.trim() : null;
      if (fromSlice) return fromSlice;
      const top = typeof d.date === "string" ? d.date.trim() : null;
      return top || null;
    } catch {
      return null;
    }
  }
  const displayDate = useMemo(() => {
    return pickStarDate(starData, starTab) || new Date(dateTimeLocal).toISOString().slice(0, 10);
  }, [starData, starTab, dateTimeLocal]);

  // URL helpers
function toApiDateTime(localDT?: string | Date) {
  if (localDT instanceof Date) {
    const y = localDT.getFullYear(), m = pad2(localDT.getMonth() + 1), day = pad2(localDT.getDate());
    const h = pad2(localDT.getHours()), mi = pad2(localDT.getMinutes());
    return `${y}-${m}-${day} ${h}:${mi}:00`;
  }
  const s = (typeof localDT === "string" && localDT) ? localDT : toLocalInputValue(new Date());
  const [ymd, hm = "00:00"] = s.split("T");
  const [h = "00", mi = "00"] = hm.split(":");
  return `${ymd} ${h}:${mi}:00`; // 补齐秒
}

  const buildUrl = (base: string, path: string, params: Record<string, string>) => {
    const u = new URL(path, base.endsWith("/") ? base : base + "/");
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  };
  const almanacUrl = useMemo(
    () => buildUrl(alapiBase, "/api/lunar", { token: alapiToken || "", date: toApiDateTime(dateTimeLocal) }),
    [alapiBase, alapiToken, dateTimeLocal]
  );

  // Fetch: Almanac
  const fetchAlmanac = async () => {
    try {
      setAlmanacLoading(true);
      setAlmanacError(null);
      const res = await fetch(almanacUrl);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setAlmanacData(json);
    } catch (e: any) {
      setAlmanacError(e?.message || String(e));
      setAlmanacData(null);
    } finally {
      setAlmanacLoading(false);
    }
  };
  useEffect(() => {
    if (expandAlmanac) fetchAlmanac();
  }, [expandAlmanac, almanacUrl]);
  useEffect(() => {
    fetchAlmanac();
  }, [almanacUrl]);

  // Fetch: Star
  const fetchStar = async (starOverride?: string, typeOverride?: string) => {
    try {
      if (starAbortRef.current) starAbortRef.current.abort();
      const controller = new AbortController();
      starAbortRef.current = controller;

      setStarLoading(true);
      setStarError(null);

      const u = new URL("/api/star", alapiBase.endsWith("/") ? alapiBase : alapiBase + "/");
      u.searchParams.set("token", alapiToken || "");
      const starRaw = starOverride ?? sign;
      const starParam = EN_SIGNS.includes(starRaw) ? starRaw : ZH_TO_EN[starRaw as any] ?? "capricorn";
      u.searchParams.set("star", starParam);
      u.searchParams.set("type", typeOverride ?? "all");
      u.searchParams.set("date", toApiDateTime(dateTimeLocal));
      u.searchParams.set("_ts", Date.now().toString());

      const res = await fetch(u.toString(), { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setStarData(json);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setStarError(e?.message || String(e));
      setStarData(null);
    } finally {
      setStarLoading(false);
    }
  };
  useEffect(() => {
    fetchStar();
  }, [sign, alapiBase, alapiToken, dateTimeLocal]);

  // Parse: Star slice
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
        { key: "综合", val: o, icon: Sparkles },
        { key: "工作", val: w, icon: Briefcase },
        { key: "爱情", val: l, icon: Heart },
        { key: "财富", val: f, icon: Wallet },
        { key: "健康", val: h, icon: Activity },
      ].filter((x) => x.val != null) as { key: string; val: number; icon: any }[];
      return out.length ? out : null;
    } catch {
      return null;
    }
  };
  const starScores = useMemo(() => pickStarScores(starSlice) ?? exampleStar.scores, [starSlice]);

  const pickStarSummary = (data: any): string | null => {
    try {
      const d: any = (data?.data ?? data) || {};
      if (typeof d.notice === "string" && d.notice.trim()) return d.notice.trim();
      const c = ["summary", "overall", "zh", "zhonghe", "general", "index", "desc", "conclusion"];
      for (const k of c) {
        const v = d[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      if (typeof d.all_text === "string" && d.all_text.trim()) return d.all_text.trim();
      return null;
    } catch {
      return null;
    }
  };
  const starSummaryFromApi = useMemo(() => pickStarSummary(starSlice), [starSlice]);

  const pickLuckyBits = (data: any) => {
    try {
      const d: any = (data?.data ?? data) || {};
      const norm = (v: any) => {
        if (v == null) return null;
        const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : String(v);
        return s ? s : null;
      };
      return {
        star: norm(d.lucky_star),
        color: norm(d.lucky_color),
        number: norm(d.lucky_number),
      };
    } catch {
      return { star: null, color: null, number: null };
    }
  };
  const luckyBits = useMemo(() => pickLuckyBits(starSlice), [starSlice]);

  // Detail blocks
  const buildDetailRich = (data: any) => {
    const d: any = (data?.data ?? data) || {};
    const arr: { title: string; icon: any; text: string }[] = [];
    const push = (title: string, icon: any, text: any) => {
      if (typeof text === "string" && text.trim()) arr.push({ title, icon, text: text.trim() });
    };
    push("综合", Sparkles, d.all_text);
    push("工作", Briefcase, d.work_text ?? d.work);
    push("爱情", Heart, d.love_text ?? d.love ?? d.emotion);
    push("财富", Wallet, d.money_text ?? d.money ?? d.finance ?? d.wealth);
    push("健康", Activity, d.health_text ?? d.health);
    return arr;
  };
  const detailRich = useMemo(() => buildDetailRich(starSlice), [starSlice]);

  // ===== Almanac parse =====
  const pickAlmanac = (data: any) => {
    try {
      const d: any = (data?.data ?? data) || {};
      return {
        caishen: d.caishen,
        caishen_desc: d.caishen_desc,
        fushen: d.fushen,
        fushen_desc: d.fushen_desc,
        xishen: d.xishen,
        xishen_desc: d.xishen_desc,
        taishen: d.taishen,
        shou: d.shou,
        xiu: d.xiu,
        xiu_animal: d.xiu_animal,
        xiu_luck: d.xiu_luck,
      };
    } catch {
      return {} as any;
    }
  };
  const almanacParsed = useMemo(() => pickAlmanac(almanacData), [almanacData]);
  const almanacDyn = useMemo(() => {
    try {
      const d: any = (almanacData?.data ?? almanacData) || {};
      const norm = (v: any): string[] => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof v === "string") {
          const seps = ["、", "，", ",", " "];
          let tmp = v;
          for (const c of seps) tmp = tmp.split(c).join(" ");
          return tmp
            .split(" ")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [];
      };
      const yiList = norm(d.yi ?? d.suit ?? d.suitable ?? d.jishen ?? d.good);
      const jiList = norm(d.ji ?? d.avoid ?? d.unsuitable ?? d.xiongsha ?? d.bad);
      let liuyue = d.liuyue;
      if (!liuyue && typeof d.youyin === "string") liuyue = d.youyin.split("·")[0];
      if (!liuyue) liuyue = d.liur || d.liuyao || d.six || "";
      return { yiList, jiList, yCount: yiList.length, jCount: jiList.length, liuyue };
    } catch {
      return { yiList: [], jiList: [], yCount: 0, jCount: 0, liuyue: "" };
    }
  }, [almanacData]);

  // ===== UI atoms =====
  const Badge = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "violet" | "emerald" | "rose" | "amber" }) => {
    const map: any = {
      slate: "bg-slate-100 text-slate-700",
      violet: "bg-violet-100 text-violet-700",
      emerald: "bg-emerald-100 text-emerald-700",
      rose: "bg-rose-100 text-rose-700",
      amber: "bg-amber-100 text-amber-700",
    };
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${map[tone]}`}>{children}</span>;
  };
  const GradBadge = ({ children, from, to, textClass = "text-slate-700" }: { children: React.ReactNode; from: string; to: string; textClass?: string }) => (
    <span className={`grad-pill ${textClass}`} style={{ ["--from" as any]: from, ["--to" as any]: to } as React.CSSProperties}>
      {children}
    </span>
  );
  const PastelTag = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <span className="pastel-badge" style={{ ["--c" as any]: color } as React.CSSProperties}>
      {children}
    </span>
  );

  // 渐变标签：根据索引在区间内插值颜色与深度（左浅右深）
  const GradientTag = ({ children, idx, total, mode }: { children: React.ReactNode; idx: number; total: number; mode: 'yi' | 'ji' }) => {
    // 加深两组主色：
    // 宜：更深的绿 -> 蓝（emerald-600 -> blue-600）
    // 忌：更深的橙 -> 红（orange-600 -> red-600）
    const yiFrom = '#047857', yiTo = '#2563EB';   // 绿色 → 蓝色（更深）
    const jiFrom = '#C2410C', jiTo = '#DC2626';   // 橙色 → 红色（更深）
    const t = total > 1 ? idx / (total - 1) : 0.5; // 0..1
    const hex = (n:number) => n.toString(16).padStart(2,'0');
    const hexToRgb = (h:string) => { const m = h.replace('#',''); return { r: parseInt(m.slice(0,2),16), g: parseInt(m.slice(2,4),16), b: parseInt(m.slice(4,6),16) }; };
    const mix = (a:string,b:string,tt:number) => { const A=hexToRgb(a), B=hexToRgb(b); const r=Math.round(A.r+(B.r-A.r)*tt), g=Math.round(A.g+(B.g-A.g)*tt), b2=Math.round(A.b+(B.b-A.b)*tt); return `#${hex(r)}${hex(g)}${hex(b2)}`; };
    const from = mode === 'yi' ? yiFrom : jiFrom;
    const to   = mode === 'yi' ? yiTo   : jiTo;
    const color = mix(from, to, t);
    const bgp = 12 + t * 16; // 12% -> 28%（当前白底不使用，仅保留参数以备扩展）
    const bdp = 55 + t * 25; // 55% -> 80% 边框更深
    return (
      <span className="pastel-badge" style={{ ["--c" as any]: color, ["--bgp" as any]: `${bgp}%`, ["--bdp" as any]: `${bdp}%` } as React.CSSProperties}>
        {children}
      </span>
    );
  };
  const StatCard = ({ title, value, gradient, Deco, decoClass }: { title: string; value: React.ReactNode; gradient: string; Deco?: any; decoClass?: string }) => (
    <div className="relative overflow-hidden rounded-2xl border p-4">
      <div className="absolute inset-0" style={{ background: gradient }} />
      <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/30 blur-2xl" />
      {Deco ? (
        <div className={`absolute right-4 bottom-3 ${decoClass ?? "text-slate-600/25"}`}>
          <Deco className="w-16 h-16" />
        </div>
      ) : null}
      <div className="relative z-10">
        <div className="text-slate-700/80 text-sm">{title}</div>
        <div className="text-3xl font-bold text-slate-800 mt-1">{value}</div>
      </div>
    </div>
  );
  const Card = ({ children }: { children: React.ReactNode }) => <div className="rounded-2xl border bg-white/80 shadow-sm backdrop-blur p-4 md:p-6">{children}</div>;
  const SectionTitle = ({ icon: Icon, title }: { icon: any; title: string }) => {
    const Used = (Icon || (Lucide as any).Sparkles) as any; // 没有传图标时用 Sparkles
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-800">
          <div className="rounded-xl bg-white border p-2 shadow-sm">
            {Used ? <Used className="w-4 h-4" /> : null}
          </div>
          <div className="text-base md:text-lg font-semibold">{title}</div>
        </div>
      </div>
    );
  };
  const Progress = ({ value }: { value: number }) => (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );

  // Reset & Mode
  const resetDefaults = () => {
    setAlapiBase("https://v3.alapi.cn");
    setAlapiToken(ALAPI_DEFAULT_TOKEN);
    setShowAlapiToken(false);
    setAiMode("official");
    setAiBase(OFFICIAL.base);
    setOpenAIKey(OFFICIAL.key);
    setOpenAIModel(OFFICIAL.model);
    setShowOpenAIKey(false);
    setDateTimeLocal(new Date().toISOString().slice(0, 16));
    setSign("capricorn");
    setStarTab("day");
    setExpandAlmanac(false);
    setShowStarDetail(false);
  };
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
  // （已移除内置星座图标）
  // （已移除星座图标组件）

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

    const cur = SIGNS.find((s) => s.value === value) || SIGNS[0];

    return (
      <div className="relative">
        <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 bg-white">
          <span className="text-slate-800 text-sm">{cur.symbol} {cur.label}</span>
          <ChevronIcon className={`w-4 h-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div ref={popRef} className="absolute z-30 mt-2 w-44 max长-80 overflow-auto rounded-xl border bg-white shadow-lg p-1">
            {SIGNS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  onChange(s.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm ${s.value === value ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50"}`}
              >
                <span className="truncate">{s.symbol} {s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ===== Home =====
  const Home = (
    <div className="space-y-6">
      {/* Almanac */}
      <Card>
        <SectionTitle icon={CalendarDays} title="每日黄历" />
        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm mb-3">
          <input type="datetime-local" value={dateTimeLocal} onChange={(e) => setDateTimeLocal(e.target.value)} className="rounded-xl border px-3 py-2 bg-white" />
          <Badge tone="slate">农历：二〇二五年九月十二</Badge>
          <Badge tone="slate">干支：乙巳年 乙酉月 癸酉日</Badge>
          <Badge tone="slate">五行：水土</Badge>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <StatCard title="吉神" value={almanacDyn.yCount || exampleAlmanac.yCount} gradient="linear-gradient(135deg,#E0F2FE,#FDE68A)" Deco={DecoGood} decoClass="text-emerald-600/25" />
          <StatCard title="凶神" value={almanacDyn.jCount || exampleAlmanac.jCount} gradient="linear-gradient(135deg,#FEE2E2,#FEF3C7)" Deco={DecoBad} decoClass="text-rose-600/25" />
          <StatCard title="六曜" value={almanacDyn.liuyue || (exampleAlmanac.youyin?.split('·')[0]) || '—'} gradient="linear-gradient(135deg,#E9D5FF,#CCFBF1)" Deco={DecoSix} decoClass="text-indigo-600/25" />
          {/* 宜（左对齐到第一列，横跨三列；忌在下方同宽） */}
          <div className="rounded-2xl border p-4 bg-emerald-50/50 md:col-span-3 md:col-start-1">
            <div className="mb-2"><span className="chip yi">宜</span></div>
            <div className="flex flex-wrap gap-2.5">{(almanacDyn.yiList && almanacDyn.yiList.length ? almanacDyn.yiList : exampleAlmanac.jishen).map((x, i) => (<GradientTag key={i} idx={i} total={(almanacDyn.yiList && almanacDyn.yiList.length ? almanacDyn.yiList.length : exampleAlmanac.jishen.length)} mode="yi">{x}</GradientTag>))}</div>
          </div>
          <div className="rounded-2xl border p-4 bg-rose-50/50 md:col-span-3 md:col-start-1">
            <div className="mb-2"><span className="chip ji">忌</span></div>
            <div className="flex flex-wrap gap-2.5">{(almanacDyn.jiList && almanacDyn.jiList.length ? almanacDyn.jiList : exampleAlmanac.xiongsha).map((x, i) => (<GradientTag key={i} idx={i} total={(almanacDyn.jiList && almanacDyn.jiList.length ? almanacDyn.jiList.length : exampleAlmanac.xiongsha.length)} mode="ji">{x}</GradientTag>))}</div>
          </div>
        </div>
        <button onClick={() => setExpandAlmanac((s) => !s)} className="mt-3 inline-flex items-center gap-1 text-sm text-slate-600">
          {expandAlmanac ? (<><ChevronIcon up className="w-4 h-4" /> 收起</>) : (<><ChevronIcon className="w-4 h-4" /> 显示更多</>)}
        </button>
        {expandAlmanac && (
          <div className="mt-3">
            <div className="text-sm text-slate-700">
              {almanacLoading ? (
                <div className="text-slate-500">正在拉取…</div>
              ) : almanacError ? (
                <div className="text-rose-600">请求失败：{almanacError}</div>
              ) : almanacData ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>财神方位：{almanacParsed?.caishen_desc}（{almanacParsed?.caishen}）</div>
                  <div>福神方位：{almanacParsed?.fushen_desc}（{almanacParsed?.fushen}）</div>
                  <div>喜神方位：{almanacParsed?.xishen_desc}（{almanacParsed?.xishen}）</div>
                  <div>胎神占方：{almanacParsed?.taishen}</div>
                  <div>值日：{almanacParsed?.shou}</div>
                  <div>宿：{almanacParsed?.xiu}（{almanacParsed?.xiu_animal}/{almanacParsed?.xiu_luck}）</div>
                </div>
              ) : (
                <div className="text-slate-500 text-xs">暂无数据</div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Star */}
      <Card>
        <SectionTitle icon={Sun} title="每日星座" />
        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm mb-3">
          <SignSelect value={sign} onChange={(v)=>setSign(v)} />
          <div className="rounded-xl border px-3 py-1.5 bg-white text-slate-600">{displayDate}</div>
          <div className="flex items-center gap-2">
            {[
              ["day", "今日"],
              ["tomorrow", "明日"],
              ["week", "本周"],
              ["month", "本月"],
              ["year", "全年"],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setStarTab(k as any)} className={`px-3 py-1.5 rounded-full text-sm border ${starTab === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {luckyBits.star && <GradBadge from={luckyGrad.star[0]} to={luckyGrad.star[1]} textClass="text-slate-700">幸运星：{luckyBits.star}</GradBadge>}
            {luckyBits.color && <GradBadge from={luckyGrad.color[0]} to={luckyGrad.color[1]} textClass="text-slate-700">幸运色：{luckyBits.color}</GradBadge>}
            {luckyBits.number && <GradBadge from={luckyGrad.number[0]} to={luckyGrad.number[1]} textClass="text-slate-700">幸运数：{luckyBits.number}</GradBadge>}
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
          <div className="text-slate-600">宜：{(starSlice?.yi ?? starSlice?.lucky ?? "—") || "—"}　　忌：{(starSlice?.ji ?? starSlice?.avoid ?? "—") || "—"}</div>
        </div>
        <div className="mt-3">
          <button onClick={() => setShowStarDetail((s) => !s)} className="inline-flex items-center gap-1 text-sm text-slate-600">
            <span>详细解读</span>
            <ChevronIcon className={`w-4 h-4 transition-transform ${showStarDetail ? "rotate-180" : ""}`} />
          </button>
          {showStarDetail && (
            <div className="mt-2 text-sm text-slate-700 leading-7">
              {starLoading ? (
                <div className="text-slate-500">正在拉取…</div>
              ) : starError ? (
                <div className="text-rose-600">请求失败：{starError}</div>
              ) : detailRich.length ? (
                detailRich.map((s, i) => (
                  <div key={i} className="mb-4">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <IconCmp Comp={s.icon} className="w-4 h-4" />
                      {s.title}
                    </div>
                    <p className="mt-1">{s.text}</p>
                  </div>
                ))
              ) : (
                exampleStar.detail.map((t, i) => <p key={i}>{t}</p>)
              )}
            </div>
          )}
        </div>
      </Card>

      {/* OpenAI Advice */}
      <Card>
        <SectionTitle icon={Wand2} title="OpenAI · 今日建议" />
        <ol className="list-decimal pl-5 space-y-2 text-slate-700 text-sm">
          {exampleAdvice.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
        <div className="mt-3">
          <button className="rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">手动生成</button>
        </div>
      </Card>
    </div>
  );

  // ===== Settings =====
  const SettingsPage = (
    <div className="space-y-6">
      <Card>
        <SectionTitle icon={Settings} title="ALAPI 设置" />
        <div className="grid md:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">ALAPI地址</div>
            <input className="w-full rounded-xl border px-3 py-2 bg-white" value={alapiBase} onChange={(e) => setAlapiBase(e.target.value)} placeholder="https://v3.alapi.cn" />
          </label>
          <label className="block">
            <div className="text-sm text-slate-600 mb-1">ALAPI秘钥</div>
            <div className="flex items-center gap-2">
              <input className="w-full rounded-xl border px-3 py-2 bg-white" type={showAlapiToken ? "text" : "password"} value={alapiToken} onChange={(e) => setAlapiToken(e.target.value)} placeholder="你的 token" />
              <button type="button" onClick={() => setShowAlapiToken((s) => !s)} className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-slate-50">{showAlapiToken ? "隐藏" : "显示"}</button>
            </div>
          </label>
        </div>
      </Card>
      <Card>
        <SectionTitle icon={Sparkles} title="OpenAI 设置" />
        <div className="mb-3 flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="aimode" checked={aiMode === 'official'} onChange={() => switchMode('official')} /> 官方设置</label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="aimode" checked={aiMode === 'custom'} onChange={() => switchMode('custom')} /> 自定义</label>
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
              <button type="button" onClick={() => setShowOpenAIKey((s) => !s)} className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-slate-50">{showOpenAIKey ? "隐藏" : "显示"}</button>
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
        <button onClick={resetDefaults} className="rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50">重置数据</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-indigo-50 via-sky-50 to-emerald-50">
      <style>{`
        /* Variation A - Pastel UI */
        .pastel-badge{
          --c:#10b981; /* 基色（运行时覆盖） */
          --bgp:12%;   /* 背景混合比例（运行时覆盖，越大越深） */
          --bdp:45%;   /* 边框混合比例（运行时覆盖，越大越深） */
          display:inline-flex; align-items:center;
          padding:4px 10px;
          border-radius:9999px; /* 更圆 */
          font-weight:400; font-size:13px; /* 不加粗 */
          color:var(--c);
          background:#fff;
          border:1.25px solid color-mix(in srgb, var(--c) var(--bdp), transparent);
          box-shadow:0 1px 0 rgba(0,0,0,.02) inset;
        }
        .chip{ display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; padding:0; border-radius:9999px; background:#fff; border:1.5px solid #fff; color:var(--chip-c); font-weight:700; font-size:16px; box-shadow:0 1px 0 rgba(0,0,0,.03) inset; }
        .chip.yi{ --chip-c:#059669; }
        .chip.ji{ --chip-c:#e11d48; }
        .grad-pill{ display:inline-flex; align-items:center; padding:6px 14px; border-radius:9999px; font-weight:600; font-size:14px; background:linear-gradient(90deg,var(--from),var(--to)); border:1px solid rgba(0,0,0,.05); box-shadow:0 1px 0 rgba(255,255,255,.7) inset; }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/70 border p-2 shadow-sm"><IconCmp Comp={Sparkles} className="w-5 h-5 text-indigo-600"/></div>
            <div>
              <div className="text-xl font-bold leading-tight">星运通</div>
              <div className="text-xs text-slate-500">星运相通，日日皆宜</div>
            </div>
          </div>
          <button onClick={() => setPage(page === 'home' ? 'settings' : 'home')} className="rounded-xl border px-3 py-2 text-sm bg-white hover:bg-slate-50 inline-flex items-center gap-2">
            <IconCmp Comp={Settings} className="w-4 h-4"/>
            {page === 'home' ? '设置' : '返回首页'}
          </button>
        </div>

        {page === 'home' ? Home : SettingsPage}
      </div>
    </div>
  );
}

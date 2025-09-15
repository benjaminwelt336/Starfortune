import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Lucide from "lucide-react";

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
    const d = localDT;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} 12:00:00`;
  }
  if (typeof localDT === "string" && localDT) {
    const [ymd] = localDT.split("T");
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return `${ymd} 12:00:00`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} 12:00:00`;
}

/* ============ Tiny UI ============ */
const Badge = ({ children, tone = "default" }: { children?: any; tone?: "default" | "good" | "bad" }) => {
  const cls =
    tone === "good"
      ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/15"
      : tone === "bad"
      ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-rose-50 text-rose-700 ring-1 ring-rose-500/15"
      : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-slate-50 text-slate-700 ring-1 ring-slate-500/15";
  return <span className={cls}>{children}</span>;
};

const Section = ({ title, icon, children }: { title: string; icon?: any; children?: any }) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
      {icon ? <span className="text-slate-600">{icon}</span> : null}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Icon = ({ name, className = "" }: { name: string; className?: string }) => {
  const Comp = (Lucide as any)[name];
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

const { CalendarDays, Sun, Settings, Sparkles, Heart, Briefcase, Wallet, Activity, Wand2 } = (Lucide as any);

/* ============ App ============ */
export default function App() {
  /* ======== Settings / 基础配置 ======== */
  const [page, setPage] = useState<"home" | "settings">("home");
  const [alapiBase, setAlapiBase] = useState<string>(getLS("alapi:base", "https://v3.alapi.cn"));
  const [alapiToken, setAlapiToken] = useState<string>(getLS("alapi:token", ""));

  const [starBase, setStarBase] = useState<string>(getLS("star:base", "https://v3.alapi.cn"));
  const [starToken, setStarToken] = useState<string>(getLS("star:token", ""));

  useEffect(() => setLS("alapi:base", alapiBase), [alapiBase]);
  useEffect(() => setLS("alapi:token", alapiToken), [alapiToken]);
  useEffect(() => setLS("star:base", starBase), [starBase]);
  useEffect(() => setLS("star:token", starToken), [starToken]);

  /* ======== 日期时间（本地） ======== */
  const [dateTimeLocal, setDateTimeLocal] = useState<string>(() => formatLocal(new Date()));
  useEffect(() => {
    const t = setInterval(() => setDateTimeLocal(formatLocal(new Date())), 1000 * 15);
    return () => clearInterval(t);
  }, []);

  /* ======== 黄历 ======== */
  const almanacEndpoint = useMemo(
    () => `${alapiBase.replace(/\/$/, "")}/api/lunar`,
    [alapiBase]
  );
  const almanacBody = useMemo(
    () => ({ date: toApiDateTime(dateTimeLocal) }),
    [dateTimeLocal]
  );

  const [almanacLoading, setAlmanacLoading] = useState(false);
  const [almanacError, setAlmanacError] = useState<string | null>(null);
  const [almanacData, setAlmanacData] = useState<any>(null);
  const almanacAbortRef = useRef<AbortController | null>(null);
  const lastAlmanacTsRef = useRef(0);
  const [almanacBackoff, setAlmanacBackoff] = useState(0);

  const fetchAlmanac = async () => {
    // 去抖：1.2s 内只发一次
    const now = Date.now();
    if (now - lastAlmanacTsRef.current < 1200) return;
    lastAlmanacTsRef.current = now;

    // 取消并发中的请求
    if (almanacAbortRef.current) almanacAbortRef.current.abort();
    const ctrl = new AbortController();
    almanacAbortRef.current = ctrl;

    setAlmanacLoading(true);
    setAlmanacError(null);

    const body = JSON.stringify(almanacBody); // { date: "YYYY-MM-DD 12:00:00" }
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      token: alapiToken || "",
    };

    // 识别限流
    const isRateLimited = (status?: number, msg?: string) =>
      status === 429 || /请求次数过多|too\s*many/i.test(msg || "");

    // 本地缓存 key（按日期）
    const cacheKey = `almanac:${(almanacBody as any)?.date ?? ""}`;

    try {
      // 优先：官方推荐写法（POST + header token + JSON body）
      let res = await fetch(almanacEndpoint, { method: "POST", headers, body, signal: ctrl.signal });
      let json: any = {};
      try { json = await res.json(); } catch {}

      if (isRateLimited(res.status, json?.message)) {
        // 命中频控：不再回退 GET，退避后自动重试
        setAlmanacError("频控触发，稍后自动重试…");
        const next = almanacBackoff ? Math.min(almanacBackoff * 2, 15000) : 3000; // 3s→6s→12s→15s
        setAlmanacBackoff(next);
        setTimeout(() => fetchAlmanac(), next);
        return;
      }

      if (!res.ok || !(json?.code === 200 || json?.success === true)) {
        // 只有非限流问题才做 GET 回退
        const u = new URL(almanacEndpoint);
        u.searchParams.set("date", (almanacBody as any)?.date ?? "");
        if (alapiToken) u.searchParams.set("token", alapiToken);
        const res2 = await fetch(u.toString(), { method: "GET", cache: "no-store", signal: ctrl.signal });
        const json2 = await res2.json();
        if (!(json2?.code === 200 || json2?.success === true)) {
          throw new Error(json2?.message || `GET ${res2.status} ${res2.statusText}`);
        }
        setAlmanacData(json2);
        setLS(cacheKey, JSON.stringify(json2));
        setAlmanacBackoff(0);
      } else {
        setAlmanacData(json);
        setLS(cacheKey, JSON.stringify(json));
        setAlmanacBackoff(0);
      }
    } catch (err: any) {
      // 失败先回退到本地缓存（若有）
      const cached = getLS(cacheKey, "");
      if (cached) { try { setAlmanacData(JSON.parse(cached)); } catch {} }
      if (err?.name !== "AbortError") {
        setAlmanacError(err?.message || "请求失败");
      }
    } finally {
      setAlmanacLoading(false);
    }
  };

  // 仅在 基址/Token/日期 变化时重拉，并且仅在页面可见时发送；避免后台标签抢配额
  useEffect(() => {
    const run = () => { if (document.visibilityState === "visible") fetchAlmanac(); };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almanacEndpoint, alapiToken, almanacBody]);

  // 解析：宜/忌 + 农历/干支/五行 + 六曜（只认 six_star）
  const almanacParsed = useMemo(() => {
    try {
      const d: any = (almanacData?.data ?? almanacData) || {};

      const normList = (v: any): string[] => {
        if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
        if (typeof v === "string") return v.split(/[、,，\s]+/).map(s => s.trim()).filter(Boolean);
        return [];
      };

      const yiList = normList(d.yi || d.suit || d.good || d.yi_ || d.yi_list);
      const jiList = normList(d.ji || d.avoid || d.bad || d.ji_ || d.ji_list);
      const liuyue = (d.six_star || d.liuyue || d.liusha || d.kayou || "").toString().trim();

      const nongli = d.nongli || d.lunar || d.lunar_text || null;
      const ganzhi = d.ganzhi || d.cyclical || null;
      const wuxing = d.wuxing || d.five || d.wuxing_text || null;

      const yCount = yiList.length;
      const jCount = jiList.length;
      return { yiList, jiList, yCount, jCount, liuyue, nongli, ganzhi, wuxing };
    } catch (_e) {
      return { yiList: [], jiList: [], yCount: 0, jCount: 0, liuyue: "", nongli: null, ganzhi: null, wuxing: null } as any;
    }
  }, [almanacData]);

  /* ======== 星座 ======== */
  const [starTab, setStarTab] = useState<"aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo" | "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces">(
    (getLS("star:tab", "aries") as any)
  );
  useEffect(() => setLS("star:tab", starTab), [starTab]);

  const starEndpoint = useMemo(() => `${starBase.replace(/\/$/, "")}/api/star`, [starBase]);
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
  const [starData, setStarData] = useState<any>(null);

  const fetchStar = async () => {
    setStarLoading(true);
    setStarError(null);

    const headers = { "Content-Type": "application/json", token: starToken || "" } as Record<string, string>;
    const body = JSON.stringify({ star: starTab }); // alapi star: {"star": "aries"}

    try {
      let res = await fetch(starEndpoint, { method: "POST", headers, body });
      if (!res.ok) throw new Error(`POST ${res.status} ${res.statusText}`);
      let json = await res.json();
      if (!(json?.code === 200 || json?.success === true)) throw new Error(json?.message || "unexpected payload");
      setStarData(json);
    } catch (err1: any) {
      try {
        const u = new URL(starEndpoint);
        u.searchParams.set("star", starTab);
        if (starToken) u.searchParams.set("token", starToken);
        const res2 = await fetch(u.toString(), { method: "GET", cache: "no-store" });
        if (!res2.ok) throw new Error(`GET ${res2.status} ${res2.statusText}`);
        const json2 = await res2.json();
        if (!(json2?.code === 200 || json2?.success === true)) throw new Error(json2?.message || "unexpected payload");
        setStarData(json2);
      } catch (err2: any) {
        setStarError(err2?.message || err1?.message || "请求失败");
        setStarData(null);
      }
    } finally {
      setStarLoading(false);
    }
  };

  useEffect(() => {
    fetchStar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starEndpoint, starToken, starTab]);

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
    const { yCount, jCount, yiList, jiList, liuyue } = almanacParsed || ({} as any);
    const yi = yiList?.slice?.(0, 6).join("、") || "—";
    const ji = jiList?.slice?.(0, 6).join("、") || "—";
    const six = liuyue || "—";
    return [
      `请基于中国黄历（宜/忌与六曜，仅作轻提示）和常见星座运势分类（综合/工作/爱情/财富/健康），生成一句“当日建议”。`,
      `避免神神叨叨；不迷信；以“轻提醒+行动建议”为主；面向普通人；中文，80字内。`,
      `当日：${displayDate}。宜(${yCount}): ${yi}；忌(${jCount}): ${ji}；六曜: ${six}。`,
    ].join("\n");
  }, [almanacParsed, displayDate]);

  const runAdvice = async () => {
    try {
      setAdvLoading(true);
      // 这里留空，方便之后接入你自己的 LLM 代理
      // 暂时从黄历/星座拼一段模板演示
      const { yCount, jCount, yiList, jiList, liuyue } = almanacParsed || ({} as any);
      const s = `今日小贴士：参考黄历“宜${yCount}、忌${jCount}${liuyue ? `，六曜${liuyue}` : ""}”，结合你的星座日运，做事宜先易后难，沟通请先倾听，再表达。保持作息与饮食清淡，减少情绪性消费。`;
      setAdvice(s);
    } finally {
      setAdvLoading(false);
    }
  };

  /* ======== UI：主页 ======== */
  const Home = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">每日黄历</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            value={dateTimeLocal}
            onChange={(e) => setDateTimeLocal(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <Section title="吉神" icon={<Sparkles className="w-4 h-4" />}>
            <div className="text-4xl font-bold">{almanacParsed?.yCount ?? 0}</div>
          </Section>
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <Section title="凶神" icon={<Activity className="w-4 h-4" />}>
            <div className="text-4xl font-bold">{almanacParsed?.jCount ?? 0}</div>
          </Section>
        </div>
        <div className="col-span-12 md:col-span-12 lg:col-span-4">
          <Section title="六曜" icon={<Sun className="w-4 h-4" />}>
            <div className="text-2xl font-semibold">{almanacParsed?.liuyue || "—"}</div>
          </Section>
        </div>
      </div>

      <Section title="宜" icon={<Wand2 className="w-4 h-4" />}>
        <div className="min-h-[44px]">
          {almanacParsed?.yiList?.length ? (
            <div className="flex flex-wrap gap-2">
              {almanacParsed.yiList.map((s: string, i: number) => (
                <Badge key={i} tone="good">{s}</Badge>
              ))}
            </div>
          ) : (
            <div className="text-slate-400">—</div>
          )}
        </div>
      </Section>

      <Section title="忌" icon={<Activity className="w-4 h-4" />}>
        <div className="min-h-[44px]">
          {almanacParsed?.jiList?.length ? (
            <div className="flex flex-wrap gap-2">
              {almanacParsed.jiList.map((s: string, i: number) => (
                <Badge key={i} tone="bad">{s}</Badge>
              ))}
            </div>
          ) : (
            <div className="text-slate-400">—</div>
          )}
        </div>
      </Section>

      {almanacLoading && <div className="text-sm text-slate-500">加载中…</div>}
      {almanacError && <div className="text-sm text-rose-600">请求失败：{almanacError}</div>}

      <div className="h-px bg-slate-200/70" />

      {/* ===== 星座 ===== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">每日星座</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={starTab}
            onChange={(e) => setStarTab(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          >
            {[
              ["aries", "白羊"], ["taurus", "金牛"], ["gemini", "双子"], ["cancer", "巨蟹"], ["leo", "狮子"], ["virgo", "处女"],
              ["libra", "天秤"], ["scorpio", "天蝎"], ["sagittarius", "射手"], ["capricorn", "摩羯"], ["aquarius", "水瓶"], ["pisces", "双鱼"],
            ].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <Section title={`今天 · ${displayDate}`} icon={<CalendarDays className="w-4 h-4" />}>
        {starLoading ? (
          <div className="text-sm text-slate-500">加载中…</div>
        ) : starError ? (
          <div className="text-sm text-rose-600">请求失败：{starError}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm"><Sparkles className="w-4 h-4" />综合</div>
              <div className="mt-1 text-lg font-semibold">{(starData?.data?.[starTab]?.zh || starData?.data?.zh || "—")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm"><Briefcase className="w-4 h-4" />工作</div>
              <div className="mt-1 text-lg font-semibold">{(starData?.data?.[starTab]?.work || starData?.data?.work || "—")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm"><Heart className="w-4 h-4" />爱情</div>
              <div className="mt-1 text-lg font-semibold">{(starData?.data?.[starTab]?.love || starData?.data?.love || "—")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm"><Wallet className="w-4 h-4" />财富</div>
              <div className="mt-1 text-lg font-semibold">{(starData?.data?.[starTab]?.money || starData?.data?.money || "—")}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-600 text-sm"><Activity className="w-4 h-4" />健康</div>
              <div className="mt-1 text-lg font-semibold">{(starData?.data?.[starTab]?.health || starData?.data?.health || "—")}</div>
            </div>
          </div>
        )}
      </Section>

      <Section title="AI 今日建议" icon={<Sparkles className="w-4 h-4" />}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-600">基于“宜/忌/六曜 + 星座”给出一句轻建议</div>
          <button
            onClick={runAdvice}
            disabled={advLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            生成
          </button>
        </div>
        <div className="mt-3 min-h-[44px] text-slate-800">{advice || <span className="text-slate-400">—</span>}</div>
      </Section>
    </div>
  );

  /* ======== UI：设置页 ======== */
  const SettingsPage = (
    <div className="space-y-6">
      <Section title="ALAPI · 万年历" icon={<Settings className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Base URL</label>
            <input
              value={alapiBase}
              onChange={(e) => setAlapiBase(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="https://v3.alapi.cn"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-slate-500">Token</label>
            <div className="relative">
              <input
                value={alapiToken}
                onChange={(e) => setAlapiToken(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm pr-16"
                placeholder="填写你的 token"
                type="password"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-slate-500 select-none">
                *****{/* 网页端显示为 ***** 的效果通过 type=password 实现 */}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="ALAPI · 星座" icon={<Settings className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Base URL</label>
            <input
              value={starBase}
              onChange={(e) => setStarBase(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="https://v3.alapi.cn"
            />
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-xs text-slate-500">Token</label>
            <input
              value={starToken}
              onChange={(e) => setStarToken(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="填写你的 token"
              type="password"
            />
          </div>
        </div>
      </Section>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-slate-600" />
            <h1 className="text-xl font-bold text-slate-800">星运通 · Starfortune</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage("home")}
              className={`rounded-lg px-3 py-1.5 text-sm border ${page === "home" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 hover:bg-slate-50"}`}
            >
              首页
            </button>
            <button
              onClick={() => setPage("settings")}
              className={`rounded-lg px-3 py-1.5 text-sm border ${page === "settings" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 hover:bg-slate-50"}`}
            >
              设置
            </button>
          </div>
        </div>

        {page === "home" ? Home : SettingsPage}
      </div>
    </div>
  );
}

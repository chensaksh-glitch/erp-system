import { useState, useEffect } from "react";

const STORAGE_KEYS = { items: "erp_items", workOrders: "erp_workorders", history: "erp_history", users: "erp_users" };

const defaultItems = [
  { id: 1, code: "RM-001", name: "철판 A", category: "원자재", unit: "kg", stock: 1200, min: 500, location: "A-1" },
  { id: 2, code: "RM-002", name: "볼트 M10", category: "원자재", unit: "개", stock: 8500, min: 2000, location: "B-3" },
  { id: 3, code: "RM-003", name: "알루미늄 판", category: "원자재", unit: "kg", stock: 340, min: 400, location: "A-2" },
  { id: 4, code: "FG-001", name: "완제품 Alpha", category: "완제품", unit: "ea", stock: 85, min: 50, location: "C-1" },
  { id: 5, code: "FG-002", name: "완제품 Beta", category: "완제품", unit: "ea", stock: 23, min: 30, location: "C-2" },
];
const defaultWOs = [
  { id: "WO-2024-001", product: "완제품 Alpha", qty: 50, planned: "2024-12-01", due: "2024-12-10", status: "완료", assignee: "김철수" },
  { id: "WO-2024-002", product: "완제품 Beta", qty: 30, planned: "2024-12-05", due: "2024-12-15", status: "진행중", assignee: "이영희" },
  { id: "WO-2024-003", product: "완제품 Alpha", qty: 100, planned: "2024-12-10", due: "2024-12-20", status: "대기", assignee: "박민준" },
];
const defaultHistory = [
  { id: 1, date: "2024-12-01", type: "입고", code: "RM-001", name: "철판 A", qty: 500, note: "정기 입고" },
  { id: 2, date: "2024-12-02", type: "출고", code: "RM-002", name: "볼트 M10", qty: 200, note: "WO-2024-001" },
  { id: 3, date: "2024-12-03", type: "입고", code: "RM-003", name: "알루미늄 판", qty: 100, note: "긴급 발주" },
];
const defaultUsers = [
  { id: 1, username: "admin",   password: "admin123",   role: "admin",   name: "관리자" },
  { id: 2, username: "manager", password: "manager123", role: "manager", name: "매니저" },
  { id: 3, username: "viewer",  password: "viewer123",  role: "viewer",  name: "뷰어" },
];
const boms = [
  { id: 1, productCode: "FG-001", productName: "완제품 Alpha", materials: [{ code: "RM-001", name: "철판 A", qty: 5, unit: "kg" }, { code: "RM-002", name: "볼트 M10", qty: 20, unit: "개" }] },
  { id: 2, productCode: "FG-002", productName: "완제품 Beta", materials: [{ code: "RM-001", name: "철판 A", qty: 3, unit: "kg" }, { code: "RM-003", name: "알루미늄 판", qty: 2, unit: "kg" }] },
];

const PERMISSIONS = {
  admin:   { canEdit: true,  canCreate: true,  canDelete: true,  canManageUsers: true  },
  manager: { canEdit: true,  canCreate: true,  canDelete: false, canManageUsers: false },
  viewer:  { canEdit: false, canCreate: false, canDelete: false, canManageUsers: false },
};

const ROLE_LABELS: Record<string, string> = { admin: "관리자", manager: "매니저", viewer: "뷰어" };

const load = (key: string, def: any) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const save = async (key: string, val: any) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const downloadCSV = (filename: string, rows: any[][]) => {
  const BOM = "﻿";
  const csv = BOM + rows.map(row =>
    row.map(cell => {
      const str = String(cell ?? "");
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  ).join("\r\n");
  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
};

const parseCSV = (text: string) => {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l: string) => l.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line: string) => {
    const result: string[] = []; let cur = ""; let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } else { inQuote = !inQuote; } }
      else if (ch === "," && !inQuote) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  return { headers: parseRow(lines[0]), rows: lines.slice(1).map(parseRow) };
};

const statusColor: Record<string, string> = { "대기": "#e6f1fb", "진행중": "#faeeda", "완료": "#eaf3de" };
const statusTextColor: Record<string, string> = { "대기": "#185fa5", "진행중": "#854f0b", "완료": "#3b6d11" };

export default function Home() {
  const [menu, setMenu] = useState("dashboard");
  const [items, setItems] = useState<any[]>(() => { if (typeof window === "undefined") return defaultItems; return load(STORAGE_KEYS.items, defaultItems); });
  const [workOrders, setWorkOrders] = useState<any[]>(() => { if (typeof window === "undefined") return defaultWOs; return load(STORAGE_KEYS.workOrders, defaultWOs); });
  const [history, setHistory] = useState<any[]>(() => { if (typeof window === "undefined") return defaultHistory; return load(STORAGE_KEYS.history, defaultHistory); });
  const [users, setUsers] = useState<any[]>(() => { if (typeof window === "undefined") return defaultUsers; return load(STORAGE_KEYS.users, defaultUsers); });
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  const [invSearch, setInvSearch] = useState("");
  const [invCategoryFilter, setInvCategoryFilter] = useState("전체");
  const [invStatusFilter, setInvStatusFilter] = useState("전체");
  const [woSearch, setWOSearch] = useState("");
  const [woStatusFilter, setWOStatusFilter] = useState("전체");
  const [histDateFrom, setHistDateFrom] = useState("");
  const [histDateTo, setHistDateTo] = useState("");
  const [histTypeFilter, setHistTypeFilter] = useState("전체");
  const [prodStatusFilter, setProdStatusFilter] = useState("전체");

  const [showIOModal, setShowIOModal] = useState(false);
  const [showWOModal, setShowWOModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  const [ioForm, setIOForm] = useState({ type: "입고", code: "", qty: "", note: "" });
  const [woForm, setWOForm] = useState({ product: "", qty: "", planned: "", due: "", assignee: "" });
  const [resultForm, setResultForm] = useState({ woId: "", actual: "", note: "" });
  const [selectedWO, setSelectedWO] = useState<any>(null);
  const [uploadStep, setUploadStep] = useState(1);
  const [uploadTarget, setUploadTarget] = useState("inventory");
  const [uploadMode, setUploadMode] = useState("merge");
  const [uploadPreview, setUploadPreview] = useState<any>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "viewer", name: "" });

  useEffect(() => {
    try { const s = sessionStorage.getItem("erp_session"); if (s) setCurrentUser(JSON.parse(s)); } catch {}
    setItems(load(STORAGE_KEYS.items, defaultItems));
    setWorkOrders(load(STORAGE_KEYS.workOrders, defaultWOs));
    setHistory(load(STORAGE_KEYS.history, defaultHistory));
    setUsers(load(STORAGE_KEYS.users, defaultUsers));
    setLoaded(true);
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const updateItems = (v: any[]) => { setItems(v); save(STORAGE_KEYS.items, v); };
  const updateWOs = (v: any[]) => { setWorkOrders(v); save(STORAGE_KEYS.workOrders, v); };
  const updateHistory = (v: any[]) => { setHistory(v); save(STORAGE_KEYS.history, v); };
  const updateUsers = (v: any[]) => { setUsers(v); save(STORAGE_KEYS.users, v); };

  const perm = currentUser ? PERMISSIONS[currentUser.role as keyof typeof PERMISSIONS] : PERMISSIONS.viewer;

  const handleLogin = () => {
    const user = users.find((u: any) => u.username === loginForm.username && u.password === loginForm.password);
    if (!user) { setLoginError("아이디 또는 비밀번호가 올바르지 않습니다."); return; }
    setCurrentUser(user); setLoginError("");
    try { sessionStorage.setItem("erp_session", JSON.stringify(user)); } catch {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try { sessionStorage.removeItem("erp_session"); } catch {}
  };

  const handleIO = () => {
    const item = items.find((i: any) => i.code === ioForm.code);
    if (!item) return alert("품목 코드를 확인해주세요.");
    const qty = parseInt(ioForm.qty);
    if (isNaN(qty) || qty <= 0) return alert("수량을 올바르게 입력해주세요.");
    const newItems = items.map((i: any) => i.code === ioForm.code ? { ...i, stock: ioForm.type === "입고" ? i.stock + qty : i.stock - qty } : i);
    const newHistory = [{ id: history.length + 1, date: new Date().toISOString().slice(0, 10), type: ioForm.type, code: ioForm.code, name: item.name, qty, note: ioForm.note }, ...history];
    updateItems(newItems); updateHistory(newHistory);
    setShowIOModal(false); setIOForm({ type: "입고", code: "", qty: "", note: "" });
    showToast("✓ 입출고 처리 완료 — 저장됨");
  };

  const handleWO = () => {
    if (!woForm.product || !woForm.qty) return alert("제품명과 수량을 입력해주세요.");
    const newWO = { id: `WO-2025-${String(workOrders.length + 1).padStart(3, "0")}`, ...woForm, qty: parseInt(woForm.qty), status: "대기" };
    updateWOs([...workOrders, newWO]);
    setShowWOModal(false); setWOForm({ product: "", qty: "", planned: "", due: "", assignee: "" });
    showToast("✓ 작업지시서 생성 완료 — 저장됨");
  };

  const handleResult = () => {
    updateWOs(workOrders.map((w: any) => w.id === resultForm.woId ? { ...w, status: "완료" } : w));
    setShowResultModal(false); setResultForm({ woId: "", actual: "", note: "" });
    showToast("✓ 생산 완료 처리 — 저장됨");
  };

  const handleReset = () => {
    updateItems(defaultItems); updateWOs(defaultWOs); updateHistory(defaultHistory);
    setShowResetConfirm(false); showToast("✓ 데이터 초기화 완료");
  };

  const handleAddUser = () => {
    if (!userForm.username || !userForm.password || !userForm.name) return alert("모든 항목을 입력해주세요.");
    if (users.find((u: any) => u.username === userForm.username)) return alert("이미 존재하는 아이디입니다.");
    updateUsers([...users, { id: Date.now(), ...userForm }]);
    setUserForm({ username: "", password: "", role: "viewer", name: "" });
    showToast("✓ 사용자 추가 완료");
  };

  const handleDeleteUser = (id: number) => {
    if (currentUser?.id === id) return alert("현재 로그인 중인 계정은 삭제할 수 없습니다.");
    updateUsers(users.filter((u: any) => u.id !== id));
    showToast("✓ 사용자 삭제 완료");
  };

  const today = new Date().toISOString().slice(0, 10);
  const exportInventory = () => downloadCSV(`재고현황_${today}.csv`, [["품목코드","품목명","분류","현재고","최소재고","단위","위치","상태"], ...items.map((i: any) => [i.code, i.name, i.category, i.stock, i.min, i.unit, i.location, i.stock < i.min ? "부족" : "정상"])]);
  const exportWorkOrders = () => downloadCSV(`작업지시서_${today}.csv`, [["지시번호","제품명","수량","계획일","완료기한","담당자","상태"], ...workOrders.map((w: any) => [w.id, w.product, w.qty, w.planned, w.due, w.assignee, w.status])]);
  const exportHistory = () => downloadCSV(`입출고이력_${today}.csv`, [["날짜","구분","품목코드","품목명","수량","비고"], ...history.map((h: any) => [h.date, h.type, h.code, h.name, h.qty, h.note])]);
  const exportBOM = () => downloadCSV(`BOM_${today}.csv`, [["제품코드","제품명","자재코드","자재명","소요량","단위"], ...boms.flatMap(b => b.materials.map(m => [b.productCode, b.productName, m.code, m.name, m.qty, m.unit]))]);
  const downloadTemplate = (type: string) => {
    if (type === "inventory") downloadCSV("재고_업로드_템플릿.csv", [["품목코드","품목명","분류","현재고","최소재고","단위","위치"], ["RM-001","예시품목","원자재","100","50","kg","A-1"]]);
    else downloadCSV("작업지시_업로드_템플릿.csv", [["지시번호","제품명","수량","계획일","완료기한","담당자","상태"], ["WO-001","완제품 Alpha","50","2025-01-01","2025-01-10","홍길동","대기"]]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setUploadPreview(parseCSV(ev.target?.result as string)); setUploadStep(3); };
    reader.readAsText(file, "UTF-8");
  };

  const applyUpload = () => {
    const { headers, rows } = uploadPreview;
    const idx = (name: string) => headers.indexOf(name);
    if (uploadTarget === "inventory") {
      const newItems = rows.map((row: string[], i: number) => ({
        id: Date.now() + i, code: row[idx("품목코드")] || "", name: row[idx("품목명")] || "",
        category: row[idx("분류")] || "원자재", stock: parseInt(row[idx("현재고")] || "0") || 0,
        min: parseInt(row[idx("최소재고")] || "0") || 0, unit: row[idx("단위")] || "개", location: row[idx("위치")] || "",
      })).filter((it: any) => it.code !== "");
      if (uploadMode === "replace") { updateItems(newItems); }
      else {
        const merged = [...items];
        newItems.forEach((ni: any) => { const ei = merged.findIndex((i: any) => i.code === ni.code); if (ei >= 0) merged[ei] = { ...merged[ei], ...ni, id: merged[ei].id }; else merged.push(ni); });
        updateItems(merged);
      }
    } else {
      const newWOs = rows.map((row: string[]) => ({
        id: row[idx("지시번호")] || `WO-${Date.now()}`, product: row[idx("제품명")] || "",
        qty: parseInt(row[idx("수량")] || "0") || 0, planned: row[idx("계획일")] || "",
        due: row[idx("완료기한")] || "", assignee: row[idx("담당자")] || "", status: row[idx("상태")] || "대기",
      })).filter((w: any) => w.product !== "");
      if (uploadMode === "replace") { updateWOs(newWOs); }
      else {
        const merged = [...workOrders];
        newWOs.forEach((nw: any) => { const ei = merged.findIndex((w: any) => w.id === nw.id); if (ei >= 0) merged[ei] = nw; else merged.push(nw); });
        updateWOs(merged);
      }
    }
    setShowUploadModal(false); setUploadPreview(null); setUploadStep(1);
    showToast("✓ CSV 업로드 완료 — 저장됨");
  };

  const categories = ["전체", ...Array.from(new Set(items.map((i: any) => i.category)))];
  const filteredItems = items.filter((i: any) => (invSearch === "" || i.code.includes(invSearch) || i.name.includes(invSearch)) && (invCategoryFilter === "전체" || i.category === invCategoryFilter) && (invStatusFilter === "전체" || (invStatusFilter === "부족" ? i.stock < i.min : i.stock >= i.min)));
  const filteredWOs = workOrders.filter((w: any) => (woSearch === "" || w.id.includes(woSearch) || w.product.includes(woSearch) || w.assignee.includes(woSearch)) && (woStatusFilter === "전체" || w.status === woStatusFilter));
  const filteredHistory = history.filter((h: any) => (histTypeFilter === "전체" || h.type === histTypeFilter) && (histDateFrom === "" || h.date >= histDateFrom) && (histDateTo === "" || h.date <= histDateTo));
  const filteredProd = workOrders.filter((w: any) => prodStatusFilter === "전체" || w.status === prodStatusFilter);

  const lowStockItems = items.filter((i: any) => i.stock < i.min);
  const activeWOs = workOrders.filter((w: any) => w.status === "진행중").length;
  const doneWOs = workOrders.filter((w: any) => w.status === "완료").length;

  const navItems = [
    { key: "dashboard", icon: "ti-layout-dashboard", label: "대시보드" },
    { key: "inventory", icon: "ti-package", label: "재고 관리" },
    { key: "bom", icon: "ti-list-details", label: "BOM 관리" },
    { key: "workorder", icon: "ti-clipboard-list", label: "작업지시서" },
    { key: "production", icon: "ti-chart-bar", label: "생산 실적" },
    ...(perm.canManageUsers ? [{ key: "users", icon: "ti-users", label: "사용자 관리" }] : []),
  ];

  const s: Record<string, any> = {
    wrap: { display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#1a1a1a", background: "#fff" },
    nav: { width: "200px", borderRight: "0.5px solid #e5e5e5", padding: "16px 0", flexShrink: 0, display: "flex", flexDirection: "column", background: "#fafafa" },
    navTop: { flex: 1 },
    navTitle: { fontSize: "13px", fontWeight: 600, color: "#666", padding: "0 16px 12px", letterSpacing: "0.05em" },
    navItem: (active: boolean) => ({ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px", cursor: "pointer", borderRadius: "6px", margin: "0 8px", background: active ? "#f0f0f0" : "transparent", color: active ? "#111" : "#666", fontSize: "13px", fontWeight: active ? 500 : 400 }),
    main: { flex: 1, padding: "20px 24px", overflow: "auto" },
    pageTitle: { fontSize: "18px", fontWeight: 600, marginBottom: "20px" },
    grid4: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" },
    card: { background: "#f9f9f9", borderRadius: "8px", padding: "14px 16px", border: "0.5px solid #e5e5e5" },
    cardLabel: { fontSize: "12px", color: "#888", marginBottom: "6px" },
    cardVal: { fontSize: "22px", fontWeight: 600 },
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "13px" },
    th: { textAlign: "left" as const, padding: "8px 12px", borderBottom: "0.5px solid #e5e5e5", color: "#888", fontWeight: 500, fontSize: "12px" },
    td: { padding: "9px 12px", borderBottom: "0.5px solid #f0f0f0" },
    badge: (st: string) => ({ display: "inline-block", padding: "2px 10px", borderRadius: "20px", fontSize: "12px", background: statusColor[st] || "#f5f5f5", color: statusTextColor[st] || "#666", fontWeight: 500 }),
    btn: { padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #ddd", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#333" },
    btnPrimary: { padding: "7px 16px", borderRadius: "6px", border: "none", background: "#185fa5", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 500 },
    btnDanger: { padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #e24b4a", background: "transparent", cursor: "pointer", fontSize: "13px", color: "#a32d2d" },
    btnSm: { padding: "4px 10px", borderRadius: "6px", border: "0.5px solid #ddd", background: "transparent", cursor: "pointer", fontSize: "12px", color: "#333" },
    modal: { position: "fixed" as const, top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modalBox: { background: "#fff", borderRadius: "12px", padding: "24px", width: "420px", border: "0.5px solid #e5e5e5", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" },
    input: { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fff", color: "#333", boxSizing: "border-box" as const },
    select: { padding: "8px 10px", borderRadius: "6px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fff", color: "#333", boxSizing: "border-box" as const },
    formRow: { marginBottom: "14px" },
    formLabel: { fontSize: "12px", color: "#888", marginBottom: "5px", display: "block" },
    section: { background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: "10px", marginBottom: "16px", overflow: "hidden" },
    sectionHead: { padding: "12px 16px", borderBottom: "0.5px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { fontSize: "14px", fontWeight: 600 },
    toast: { position: "fixed" as const, bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#185fa5", color: "#fff", padding: "10px 20px", borderRadius: "20px", fontSize: "13px", zIndex: 9999, pointerEvents: "none" as const, opacity: toast ? 1 : 0, transition: "opacity 0.3s" },
    saveBadge: { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#3b6d11", background: "#eaf3de", padding: "3px 8px", borderRadius: "12px" },
    filterBar: { display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" as const, alignItems: "center" },
    filterInput: { padding: "6px 10px", borderRadius: "6px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fff", color: "#333", width: "180px" },
    filterSelect: { padding: "6px 10px", borderRadius: "6px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fff", color: "#333" },
    filterDate: { padding: "6px 10px", borderRadius: "6px", border: "0.5px solid #ddd", fontSize: "13px", background: "#fff", color: "#333", width: "130px" },
    btnGroup: { display: "flex", gap: "6px" },
  };

  if (!loaded) return <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>불러오는 중...</div>;

  if (!currentUser) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#f5f5f5" }}>
      <div style={{ background: "#fff", border: "0.5px solid #e5e5e5", borderRadius: "12px", padding: "32px", width: "340px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "6px" }}>ERP 시스템</div>
        <div style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>계정으로 로그인하세요</div>
        <div style={s.formRow}>
          <label style={s.formLabel}>아이디</label>
          <input style={s.input} placeholder="username" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        <div style={s.formRow}>
          <label style={s.formLabel}>비밀번호</label>
          <input style={s.input} type="password" placeholder="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        {loginError && <div style={{ fontSize: "12px", color: "#a32d2d", marginBottom: "12px" }}>{loginError}</div>}
        <button style={{ ...s.btnPrimary, width: "100%" }} onClick={handleLogin}>로그인</button>
        <div style={{ marginTop: "20px", padding: "12px", background: "#f9f9f9", borderRadius: "8px", fontSize: "12px", color: "#888", lineHeight: "1.8" }}>
          <div style={{ fontWeight: 600, marginBottom: "4px", color: "#555" }}>기본 계정</div>
          <div>admin / admin123 (관리자)</div>
          <div>manager / manager123 (매니저)</div>
          <div>viewer / viewer123 (뷰어)</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.nav}>
        <div style={s.navTop}>
          <div style={s.navTitle}>ERP 시스템</div>
          {navItems.map(n => (
            <div key={n.key} style={s.navItem(menu === n.key)} onClick={() => setMenu(n.key)}>
              {n.label}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px 16px", borderTop: "0.5px solid #e5e5e5" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>{currentUser.name}</div>
          <div style={{ fontSize: "11px", color: "#888", marginBottom: "8px" }}>{ROLE_LABELS[currentUser.role]}</div>
          <span style={s.saveBadge}>자동 저장 중</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
            {perm.canDelete && (
              <button style={{ ...s.btnDanger, fontSize: "12px", padding: "5px 10px", width: "100%", textAlign: "left" }} onClick={() => setShowResetConfirm(true)}>데이터 초기화</button>
            )}
            <button style={{ ...s.btn, fontSize: "12px", padding: "5px 10px", width: "100%", textAlign: "left" }} onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      </div>

      <div style={s.main}>
        {menu === "dashboard" && (
          <>
            <div style={s.pageTitle}>대시보드</div>
            <div style={s.grid4}>
              {[{ label: "전체 품목", val: items.length + " 종" }, { label: "재고 부족 품목", val: lowStockItems.length + " 건", warn: lowStockItems.length > 0 }, { label: "진행중 작업지시", val: activeWOs + " 건" }, { label: "이번달 완료", val: doneWOs + " 건" }].map((m, i) => (
                <div key={i} style={{ ...s.card, borderLeft: m.warn ? "3px solid #e24b4a" : "3px solid transparent" }}>
                  <div style={s.cardLabel}>{m.label}</div>
                  <div style={{ ...s.cardVal, color: m.warn ? "#a32d2d" : "#1a1a1a" }}>{m.val}</div>
                </div>
              ))}
            </div>
            {lowStockItems.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionHead}><span style={{ ...s.sectionTitle, color: "#a32d2d" }}>재고 부족 알림</span></div>
                <table style={s.table}><thead><tr>{["품목코드","품목명","현재고","최소재고","단위"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{lowStockItems.map((i: any) => <tr key={i.id}><td style={s.td}>{i.code}</td><td style={s.td}>{i.name}</td><td style={{ ...s.td, color: "#a32d2d", fontWeight: 600 }}>{i.stock.toLocaleString()}</td><td style={s.td}>{i.min.toLocaleString()}</td><td style={s.td}>{i.unit}</td></tr>)}</tbody></table>
              </div>
            )}
            <div style={s.section}>
              <div style={s.sectionHead}><span style={s.sectionTitle}>진행중 작업지시</span><button style={s.btn} onClick={() => setMenu("workorder")}>전체 보기</button></div>
              <table style={s.table}><thead><tr>{["지시번호","제품명","수량","완료기한","담당자","상태"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{workOrders.filter((w: any) => w.status !== "완료").map((w: any) => <tr key={w.id}><td style={s.td}>{w.id}</td><td style={s.td}>{w.product}</td><td style={s.td}>{w.qty.toLocaleString()}</td><td style={s.td}>{w.due}</td><td style={s.td}>{w.assignee}</td><td style={s.td}><span style={s.badge(w.status)}>{w.status}</span></td></tr>)}</tbody></table>
            </div>
          </>
        )}

        {menu === "inventory" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={s.pageTitle}>재고 관리</div>
              <div style={s.btnGroup}>
                {perm.canCreate && <button style={s.btn} onClick={() => { setUploadTarget("inventory"); setUploadStep(1); setUploadPreview(null); setShowUploadModal(true); }}>CSV 업로드</button>}
                {perm.canCreate && <button style={s.btnPrimary} onClick={() => setShowIOModal(true)}>+ 입출고 처리</button>}
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>품목 현황 <span style={{ color: "#888", fontWeight: 400, fontSize: "12px" }}>({filteredItems.length}/{items.length})</span></span>
                <button style={s.btnSm} onClick={exportInventory}>CSV 내보내기</button>
              </div>
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #f0f0f0" }}>
                <div style={s.filterBar}>
                  <input style={s.filterInput} placeholder="코드/이름 검색" value={invSearch} onChange={e => setInvSearch(e.target.value)} />
                  <select style={s.filterSelect} value={invCategoryFilter} onChange={e => setInvCategoryFilter(e.target.value)}>{categories.map((c: any) => <option key={c}>{c}</option>)}</select>
                  <select style={s.filterSelect} value={invStatusFilter} onChange={e => setInvStatusFilter(e.target.value)}>{["전체","정상","부족"].map(c => <option key={c}>{c}</option>)}</select>
                  {(invSearch || invCategoryFilter !== "전체" || invStatusFilter !== "전체") && <button style={s.btnSm} onClick={() => { setInvSearch(""); setInvCategoryFilter("전체"); setInvStatusFilter("전체"); }}>초기화</button>}
                </div>
              </div>
              <table style={s.table}><thead><tr>{["품목코드","품목명","분류","현재고","최소재고","단위","위치","상태"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{filteredItems.length === 0 ? <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#888", padding: "24px" }}>검색 결과 없음</td></tr> : filteredItems.map((i: any) => <tr key={i.id}><td style={s.td}>{i.code}</td><td style={s.td}>{i.name}</td><td style={s.td}>{i.category}</td><td style={{ ...s.td, fontWeight: 600, color: i.stock < i.min ? "#a32d2d" : "#1a1a1a" }}>{i.stock.toLocaleString()}</td><td style={s.td}>{i.min.toLocaleString()}</td><td style={s.td}>{i.unit}</td><td style={s.td}>{i.location}</td><td style={s.td}><span style={{ ...s.badge("완료"), background: i.stock < i.min ? "#fcebeb" : "#eaf3de", color: i.stock < i.min ? "#a32d2d" : "#3b6d11" }}>{i.stock < i.min ? "부족" : "정상"}</span></td></tr>)}</tbody></table>
            </div>
            <div style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>입출고 이력 <span style={{ color: "#888", fontWeight: 400, fontSize: "12px" }}>({filteredHistory.length}/{history.length})</span></span>
                <button style={s.btnSm} onClick={exportHistory}>CSV 내보내기</button>
              </div>
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #f0f0f0" }}>
                <div style={s.filterBar}>
                  <select style={s.filterSelect} value={histTypeFilter} onChange={e => setHistTypeFilter(e.target.value)}>{["전체","입고","출고"].map(c => <option key={c}>{c}</option>)}</select>
                  <input type="date" style={s.filterDate} value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)} />
                  <span style={{ alignSelf: "center", fontSize: "12px", color: "#888" }}>~</span>
                  <input type="date" style={s.filterDate} value={histDateTo} onChange={e => setHistDateTo(e.target.value)} />
                  {(histTypeFilter !== "전체" || histDateFrom || histDateTo) && <button style={s.btnSm} onClick={() => { setHistTypeFilter("전체"); setHistDateFrom(""); setHistDateTo(""); }}>초기화</button>}
                </div>
              </div>
              <table style={s.table}><thead><tr>{["날짜","구분","품목코드","품목명","수량","비고"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{filteredHistory.length === 0 ? <tr><td colSpan={6} style={{ ...s.td, textAlign: "center", color: "#888", padding: "24px" }}>검색 결과 없음</td></tr> : filteredHistory.map((h: any) => <tr key={h.id}><td style={s.td}>{h.date}</td><td style={s.td}><span style={{ ...s.badge("완료"), background: h.type === "입고" ? "#e6f1fb" : "#faeeda", color: h.type === "입고" ? "#185fa5" : "#854f0b" }}>{h.type}</span></td><td style={s.td}>{h.code}</td><td style={s.td}>{h.name}</td><td style={s.td}>{h.qty.toLocaleString()}</td><td style={{ ...s.td, color: "#888" }}>{h.note}</td></tr>)}</tbody></table>
            </div>
          </>
        )}

        {menu === "bom" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={s.pageTitle}>BOM 관리</div>
              <button style={s.btnSm} onClick={exportBOM}>CSV 내보내기</button>
            </div>
            {boms.map(b => <div key={b.id} style={s.section}><div style={s.sectionHead}><span style={s.sectionTitle}>{b.productName} <span style={{ color: "#888", fontWeight: 400, fontSize: "12px" }}>{b.productCode}</span></span></div><table style={s.table}><thead><tr>{["자재코드","자재명","소요량","단위"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{b.materials.map((m, i) => <tr key={i}><td style={s.td}>{m.code}</td><td style={s.td}>{m.name}</td><td style={s.td}>{m.qty}</td><td style={s.td}>{m.unit}</td></tr>)}</tbody></table></div>)}
          </>
        )}

        {menu === "workorder" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={s.pageTitle}>작업지시서</div>
              <div style={s.btnGroup}>
                {perm.canCreate && <button style={s.btn} onClick={() => { setUploadTarget("workorder"); setUploadStep(1); setUploadPreview(null); setShowUploadModal(true); }}>CSV 업로드</button>}
                {perm.canCreate && <button style={s.btnPrimary} onClick={() => setShowWOModal(true)}>+ 작업지시 생성</button>}
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>작업지시 목록 <span style={{ color: "#888", fontWeight: 400, fontSize: "12px" }}>({filteredWOs.length}/{workOrders.length})</span></span>
                <button style={s.btnSm} onClick={exportWorkOrders}>CSV 내보내기</button>
              </div>
              <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #f0f0f0" }}>
                <div style={s.filterBar}>
                  <input style={s.filterInput} placeholder="번호/제품명/담당자 검색" value={woSearch} onChange={e => setWOSearch(e.target.value)} />
                  <select style={s.filterSelect} value={woStatusFilter} onChange={e => setWOStatusFilter(e.target.value)}>{["전체","대기","진행중","완료"].map(c => <option key={c}>{c}</option>)}</select>
                  {(woSearch || woStatusFilter !== "전체") && <button style={s.btnSm} onClick={() => { setWOSearch(""); setWOStatusFilter("전체"); }}>초기화</button>}
                </div>
              </div>
              <table style={s.table}><thead><tr>{["지시번호","제품명","수량","계획일","완료기한","담당자","상태","액션"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{filteredWOs.length === 0 ? <tr><td colSpan={8} style={{ ...s.td, textAlign: "center", color: "#888", padding: "24px" }}>검색 결과 없음</td></tr> : filteredWOs.map((w: any) => <tr key={w.id}><td style={s.td}>{w.id}</td><td style={s.td}>{w.product}</td><td style={s.td}>{w.qty.toLocaleString()}</td><td style={s.td}>{w.planned}</td><td style={s.td}>{w.due}</td><td style={s.td}>{w.assignee}</td><td style={s.td}><span style={s.badge(w.status)}>{w.status}</span></td><td style={s.td}>{perm.canEdit && w.status === "대기" && <button style={s.btnSm} onClick={() => { updateWOs(workOrders.map((x: any) => x.id === w.id ? { ...x, status: "진행중" } : x)); showToast("✓ 상태 변경 저장됨"); }}>시작</button>}{perm.canEdit && w.status === "진행중" && <button style={s.btnSm} onClick={() => { setSelectedWO(w); setResultForm({ woId: w.id, actual: "", note: "" }); setShowResultModal(true); }}>완료처리</button>}</td></tr>)}</tbody></table>
            </div>
          </>
        )}

        {menu === "production" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={s.pageTitle}>생산 실적</div>
              <button style={s.btnSm} onClick={exportWorkOrders}>CSV 내보내기</button>
            </div>
            <div style={s.grid4}>
              {[{ label: "총 작업지시", val: workOrders.length + " 건" }, { label: "대기", val: workOrders.filter((w: any)=>w.status==="대기").length + " 건" }, { label: "진행중", val: workOrders.filter((w: any)=>w.status==="진행중").length + " 건" }, { label: "완료", val: workOrders.filter((w: any)=>w.status==="완료").length + " 건" }].map((m, i) => <div key={i} style={s.card}><div style={s.cardLabel}>{m.label}</div><div style={s.cardVal}>{m.val}</div></div>)}
            </div>
            <div style={s.section}>
              <div style={s.sectionHead}>
                <span style={s.sectionTitle}>작업 내역 <span style={{ color: "#888", fontWeight: 400, fontSize: "12px" }}>({filteredProd.length}/{workOrders.length})</span></span>
                <select style={{ ...s.filterSelect, fontSize: "12px" }} value={prodStatusFilter} onChange={e => setProdStatusFilter(e.target.value)}>{["전체","대기","진행중","완료"].map(c => <option key={c}>{c}</option>)}</select>
              </div>
              <table style={s.table}><thead><tr>{["지시번호","제품명","지시수량","담당자","계획일","완료기한","상태"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{filteredProd.length === 0 ? <tr><td colSpan={7} style={{ ...s.td, textAlign: "center", color: "#888", padding: "24px" }}>검색 결과 없음</td></tr> : filteredProd.map((w: any) => <tr key={w.id}><td style={s.td}>{w.id}</td><td style={s.td}>{w.product}</td><td style={s.td}>{w.qty.toLocaleString()}</td><td style={s.td}>{w.assignee}</td><td style={s.td}>{w.planned}</td><td style={s.td}>{w.due}</td><td style={s.td}><span style={s.badge(w.status)}>{w.status}</span></td></tr>)}</tbody></table>
            </div>
          </>
        )}

        {menu === "users" && perm.canManageUsers && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={s.pageTitle}>사용자 관리</div>
              <button style={s.btnPrimary} onClick={() => setShowUserModal(true)}>+ 사용자 추가</button>
            </div>
            <div style={s.section}>
              <div style={s.sectionHead}><span style={s.sectionTitle}>계정 목록</span></div>
              <table style={s.table}><thead><tr>{["이름","아이디","권한","액션"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{users.map((u: any) => <tr key={u.id}><td style={s.td}>{u.name}</td><td style={s.td}>{u.username}</td><td style={s.td}><span style={s.badge(u.role === "admin" ? "완료" : u.role === "manager" ? "진행중" : "대기")}>{ROLE_LABELS[u.role]}</span></td><td style={s.td}>{u.id !== currentUser.id && <button style={{ ...s.btnSm, color: "#a32d2d", borderColor: "#e24b4a" }} onClick={() => handleDeleteUser(u.id)}>삭제</button>}</td></tr>)}</tbody></table>
            </div>
          </>
        )}
      </div>

      {toast && <div style={s.toast}>{toast}</div>}

      {showIOModal && <div style={s.modal}><div style={s.modalBox}><div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "18px" }}>입출고 처리</div>{[{ label: "구분", el: <select style={{ ...s.select, width: "100%" }} value={ioForm.type} onChange={e => setIOForm({ ...ioForm, type: e.target.value })}><option>입고</option><option>출고</option></select> }, { label: "품목코드", el: <input style={s.input} placeholder="예: RM-001" value={ioForm.code} onChange={e => setIOForm({ ...ioForm, code: e.target.value })} /> }, { label: "수량", el: <input style={s.input} type="number" placeholder="수량 입력" value={ioForm.qty} onChange={e => setIOForm({ ...ioForm, qty: e.target.value })} /> }, { label: "비고", el: <input style={s.input} placeholder="비고 (선택)" value={ioForm.note} onChange={e => setIOForm({ ...ioForm, note: e.target.value })} /> }].map(f => <div key={f.label} style={s.formRow}><label style={s.formLabel}>{f.label}</label>{f.el}</div>)}<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => setShowIOModal(false)}>취소</button><button style={s.btnPrimary} onClick={handleIO}>처리</button></div></div></div>}

      {showWOModal && <div style={s.modal}><div style={s.modalBox}><div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "18px" }}>작업지시 생성</div>{[{ label: "제품명", el: <input style={s.input} placeholder="예: 완제품 Alpha" value={woForm.product} onChange={e => setWOForm({ ...woForm, product: e.target.value })} /> }, { label: "수량", el: <input style={s.input} type="number" value={woForm.qty} onChange={e => setWOForm({ ...woForm, qty: e.target.value })} /> }, { label: "계획일", el: <input style={s.input} type="date" value={woForm.planned} onChange={e => setWOForm({ ...woForm, planned: e.target.value })} /> }, { label: "완료기한", el: <input style={s.input} type="date" value={woForm.due} onChange={e => setWOForm({ ...woForm, due: e.target.value })} /> }, { label: "담당자", el: <input style={s.input} placeholder="담당자명" value={woForm.assignee} onChange={e => setWOForm({ ...woForm, assignee: e.target.value })} /> }].map(f => <div key={f.label} style={s.formRow}><label style={s.formLabel}>{f.label}</label>{f.el}</div>)}<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => setShowWOModal(false)}>취소</button><button style={s.btnPrimary} onClick={handleWO}>생성</button></div></div></div>}

      {showResultModal && <div style={s.modal}><div style={s.modalBox}><div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>생산 완료 처리</div><div style={{ fontSize: "13px", color: "#888", marginBottom: "18px" }}>{selectedWO?.id} · {selectedWO?.product}</div>{[{ label: "실제 생산수량", el: <input style={s.input} type="number" value={resultForm.actual} onChange={e => setResultForm({ ...resultForm, actual: e.target.value })} /> }, { label: "비고", el: <input style={s.input} placeholder="특이사항 (선택)" value={resultForm.note} onChange={e => setResultForm({ ...resultForm, note: e.target.value })} /> }].map(f => <div key={f.label} style={s.formRow}><label style={s.formLabel}>{f.label}</label>{f.el}</div>)}<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => setShowResultModal(false)}>취소</button><button style={s.btnPrimary} onClick={handleResult}>완료 처리</button></div></div></div>}

      {showResetConfirm && <div style={s.modal}><div style={{ ...s.modalBox, width: "320px" }}><div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "10px" }}>데이터 초기화</div><div style={{ fontSize: "13px", color: "#888", marginBottom: "20px" }}>저장된 모든 데이터가 샘플 데이터로 초기화됩니다. 계속하시겠습니까?</div><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => setShowResetConfirm(false)}>취소</button><button style={{ ...s.btnPrimary, background: "#a32d2d" }} onClick={handleReset}>초기화</button></div></div></div>}

      {showUploadModal && <div style={s.modal}><div style={{ ...s.modalBox, width: "500px" }}>
        <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>CSV 업로드</div>
        <div style={{ fontSize: "12px", color: "#888", marginBottom: "20px" }}>{uploadStep === 1 ? "① 대상 및 방식 선택" : uploadStep === 2 ? "② 파일 선택" : "③ 미리보기 확인"}</div>
        {uploadStep === 1 && <><div style={s.formRow}><label style={s.formLabel}>업로드 대상</label><select style={{ ...s.select, width: "100%" }} value={uploadTarget} onChange={e => setUploadTarget(e.target.value)}><option value="inventory">재고 데이터</option><option value="workorder">작업지시서</option></select></div><div style={s.formRow}><label style={s.formLabel}>가져오기 방식</label><select style={{ ...s.select, width: "100%" }} value={uploadMode} onChange={e => setUploadMode(e.target.value)}><option value="merge">병합 (기존 유지, 코드 일치 시 덮어쓰기)</option><option value="replace">교체 (기존 전체 삭제 후 교체)</option></select></div><div style={{ marginBottom: "16px", padding: "10px 12px", background: "#f9f9f9", borderRadius: "8px", fontSize: "12px", color: "#888" }}>템플릿 다운로드: <button style={{ ...s.btnSm, fontSize: "11px", marginLeft: "6px" }} onClick={() => downloadTemplate(uploadTarget)}>{uploadTarget === "inventory" ? "재고 템플릿" : "작업지시 템플릿"}</button></div><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => setShowUploadModal(false)}>취소</button><button style={s.btnPrimary} onClick={() => setUploadStep(2)}>다음</button></div></>}
        {uploadStep === 2 && <><div style={{ border: "2px dashed #ddd", borderRadius: "8px", padding: "32px", textAlign: "center", marginBottom: "16px" }}><div style={{ fontSize: "13px", marginBottom: "12px", color: "#888" }}>CSV 파일을 선택하세요</div><label style={{ ...s.btnPrimary, display: "inline-block", cursor: "pointer" }}>파일 선택<input type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileSelect} /></label></div><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => setUploadStep(1)}>이전</button><button style={s.btn} onClick={() => setShowUploadModal(false)}>취소</button></div></>}
        {uploadStep === 3 && uploadPreview && <><div style={{ marginBottom: "12px" }}><div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>파싱 결과: {uploadPreview.rows.length}행</div><div style={{ overflowX: "auto", border: "0.5px solid #e5e5e5", borderRadius: "8px" }}><table style={{ ...s.table, fontSize: "12px" }}><thead><tr>{uploadPreview.headers.map((h: string, i: number) => <th key={i} style={s.th}>{h}</th>)}</tr></thead><tbody>{uploadPreview.rows.slice(0, 5).map((row: string[], ri: number) => <tr key={ri}>{row.map((cell: string, ci: number) => <td key={ci} style={s.td}>{cell}</td>)}</tr>)}</tbody></table></div>{uploadPreview.rows.length > 5 && <div style={{ fontSize: "11px", color: "#888", marginTop: "4px", textAlign: "right" }}>외 {uploadPreview.rows.length - 5}행...</div>}</div><div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => { setUploadStep(2); setUploadPreview(null); }}>이전</button><button style={s.btn} onClick={() => setShowUploadModal(false)}>취소</button><button style={s.btnPrimary} onClick={applyUpload}>가져오기</button></div></>}
      </div></div>}

      {showUserModal && <div style={s.modal}><div style={s.modalBox}><div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "18px" }}>사용자 추가</div>{[{ label: "이름", el: <input style={s.input} placeholder="표시 이름" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} /> }, { label: "아이디", el: <input style={s.input} placeholder="로그인 아이디" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} /> }, { label: "비밀번호", el: <input style={s.input} type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} /> }, { label: "권한", el: <select style={{ ...s.select, width: "100%" }} value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}><option value="viewer">뷰어 (조회만)</option><option value="manager">매니저 (조회+수정)</option><option value="admin">관리자 (전체)</option></select> }].map(f => <div key={f.label} style={s.formRow}><label style={s.formLabel}>{f.label}</label>{f.el}</div>)}<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}><button style={s.btn} onClick={() => { setShowUserModal(false); setUserForm({ username: "", password: "", role: "viewer", name: "" }); }}>취소</button><button style={s.btnPrimary} onClick={() => { handleAddUser(); setShowUserModal(false); }}>추가</button></div></div></div>}
    </div>
  );
}

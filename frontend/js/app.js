/**
 * DineDesk: Restaurant Reservation & Kitchen Order Console
 * Full-Featured React 18 Single Page Application
 */

const { useState, useEffect, useMemo, useRef } = React;

// -------------------------------------------------------------
// API Helper
// -------------------------------------------------------------
const api = {
  async get(url, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },
  async post(url, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },
  async patch(url, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },
};

// -------------------------------------------------------------
// Lucide Icon Helper
// -------------------------------------------------------------
function Icon({ name, size = 18, className = "" }) {
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [name]);
  return <i data-lucide={name} style={{ width: size, height: size }} className={`inline-block align-middle ${className}`} />;
}

// -------------------------------------------------------------
// Main Application Component
// -------------------------------------------------------------
function DineDeskApp() {
  // Navigation & User State
  const [activeTab, setActiveTab] = useState("landing");
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("dinedesk_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("dinedesk_token") || "");

  // Modals & Popups
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState(null);
  const [activeKOTOrder, setActiveKOTOrder] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [confirmedReservation, setConfirmedReservation] = useState(null);

  // Core Data Stores
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [kitchenLanes, setKitchenLanes] = useState({ new: [], preparing: [], ready: [], served: [] });
  const [waitlist, setWaitlist] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // UI Notifications (Toasts)
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Persist session
  const saveAuth = (user, jwtToken) => {
    setCurrentUser(user);
    setToken(jwtToken);
    localStorage.setItem("dinedesk_user", JSON.stringify(user));
    localStorage.setItem("dinedesk_token", jwtToken);
  };

  const handleLogout = async () => {
    if (token) {
      await api.post("/api/auth/logout", {}, token);
    }
    setCurrentUser(null);
    setToken("");
    localStorage.removeItem("dinedesk_user");
    localStorage.removeItem("dinedesk_token");
    addToast("Logged out successfully", "info");
    setActiveTab("landing");
  };

  // Quick Switcher for Demo
  const quickSwitchRole = async (targetRole) => {
    const credentials = {
      host: { email: "host@dinedesk.com", password: "HostPass123!" },
      kitchen: { email: "kitchen@dinedesk.com", password: "KitchenPass123!" },
      admin: { email: "admin@dinedesk.com", password: "AdminPass123!" },
    };
    const cred = credentials[targetRole];
    if (!cred) return;
    const res = await api.post("/api/auth/login", cred);
    if (res.ok) {
      saveAuth(res.data.user, res.data.token);
      addToast(`Switched to ${res.data.user.name} (${res.data.user.role.toUpperCase()})`, "success");
      if (targetRole === "host") setActiveTab("host");
      else if (targetRole === "kitchen") setActiveTab("kitchen");
      else if (targetRole === "admin") setActiveTab("admin");
    } else {
      addToast("Failed to switch role: " + (res.data.error || "Unknown error"), "error");
    }
  };

  // Initial & Periodic Data Fetching
  const refreshAllData = async () => {
    // Tables
    const tRes = await api.get("/api/tables");
    if (tRes.ok) setTables(tRes.data.tables || []);

    // Menu
    const mRes = await api.get("/api/menu");
    if (mRes.ok) setMenuItems(mRes.data.menu_items || []);

    // Kitchen Board
    const kRes = await api.get("/api/kitchen/board");
    if (kRes.ok) setKitchenLanes(kRes.data.lanes || { new: [], preparing: [], ready: [], served: [] });

    // Reservations (Host/Admin)
    const rRes = await api.get("/api/reservations");
    if (rRes.ok) setReservations(rRes.data.reservations || []);

    // Waitlist
    const wRes = await api.get("/api/waitlist");
    if (wRes.ok) setWaitlist(wRes.data.waitlist || []);

    // Analytics
    const aRes = await api.get("/api/analytics/utilization");
    if (aRes.ok) setAnalytics(aRes.data);

    // Audit Logs
    const lRes = await api.get("/api/audit-logs");
    if (lRes.ok) setAuditLogs(lRes.data.audit_logs || []);

    // System Logs
    const sRes = await api.get("/api/system/logs");
    if (sRes.ok) setSystemLogs(sRes.data.system_logs || []);
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 12000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all ${
              t.type === "success"
                ? "bg-emerald-950/90 border-emerald-700 text-emerald-100"
                : t.type === "error"
                ? "bg-rose-950/90 border-rose-700 text-rose-100"
                : "bg-slate-900/90 border-slate-700 text-slate-100"
            }`}
          >
            <Icon
              name={t.type === "success" ? "check-circle" : t.type === "error" ? "alert-circle" : "info"}
              size={20}
              className={`shrink-0 mt-0.5 ${
                t.type === "success" ? "text-emerald-400" : t.type === "error" ? "text-rose-400" : "text-sky-400"
              }`}
            />
            <div className="text-sm font-medium leading-snug">{t.message}</div>
          </div>
        ))}
      </div>

      {/* Top Brand & Demo Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setActiveTab("landing")}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-amberAccent-500 flex items-center justify-center text-white shadow-md shadow-brand-700/20 group-hover:scale-105 transition-smooth">
                <span className="text-xl">🍽️</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tracking-tight text-slate-900">DineDesk</span>
                  <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-md bg-brand-100 text-brand-800">
                    Project 05
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Restaurant Reservation & Kitchen Order Console
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setActiveTab("landing")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth ${
                  activeTab === "landing" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Menu
              </button>
              <button
                onClick={() => setActiveTab("reserve")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth ${
                  activeTab === "reserve" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Reserve Table
              </button>
              <button
                onClick={() => setActiveTab("lookup")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth ${
                  activeTab === "lookup" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                My Booking
              </button>
              <div className="h-5 w-px bg-slate-200 mx-1" />
              <button
                onClick={() => setActiveTab("host")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth flex items-center gap-1.5 ${
                  activeTab === "host" ? "bg-brand-700 text-white shadow-sm" : "text-slate-700 hover:text-brand-700 hover:bg-brand-50"
                }`}
              >
                <Icon name="layout-dashboard" size={15} />
                Host Board
              </button>
              <button
                onClick={() => setActiveTab("kitchen")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth flex items-center gap-1.5 ${
                  activeTab === "kitchen" ? "bg-amber-600 text-white shadow-sm" : "text-slate-700 hover:text-amber-700 hover:bg-amber-50"
                }`}
              >
                <Icon name="utensils" size={15} />
                Kitchen KDS
              </button>
              <button
                onClick={() => setActiveTab("recipes")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth flex items-center gap-1.5 ${
                  activeTab === "recipes" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon name="search" size={15} />
                Chef Recipes
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-smooth flex items-center gap-1.5 ${
                  activeTab === "admin" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon name="activity" size={15} />
                Analytics & Logs
              </button>
            </nav>

            {/* Right Controls: Quick Role Switcher & Auth */}
            <div className="flex items-center gap-2">
              {/* Demo Quick Role Switcher */}
              <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-400 px-2 font-medium">Demo:</span>
                <button
                  onClick={() => quickSwitchRole("host")}
                  className={`px-2 py-1 rounded font-medium transition-smooth ${
                    currentUser?.role === "host" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Switch to Elena Rostova (Host / Receptionist)"
                >
                  🛎️ Host
                </button>
                <button
                  onClick={() => quickSwitchRole("kitchen")}
                  className={`px-2 py-1 rounded font-medium transition-smooth ${
                    currentUser?.role === "kitchen" ? "bg-white text-amber-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Switch to Marco Bellini (Kitchen Chef)"
                >
                  👨‍🍳 Kitchen
                </button>
                <button
                  onClick={() => quickSwitchRole("admin")}
                  className={`px-2 py-1 rounded font-medium transition-smooth ${
                    currentUser?.role === "admin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Switch to David Kim (General Manager)"
                >
                  👔 Admin
                </button>
              </div>

              {/* Login / User Status */}
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                    <div className="w-6 h-6 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center font-bold">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-slate-800 leading-none">{currentUser.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono capitalize leading-tight mt-0.5">
                        {currentUser.role}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-smooth"
                    title="Sign Out"
                  >
                    <Icon name="log-out" size={18} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition-smooth flex items-center gap-2"
                >
                  <Icon name="lock" size={15} />
                  Staff Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "landing" && (
          <LandingView
            menuItems={menuItems}
            onBookClick={() => setActiveTab("reserve")}
            onLookupClick={() => setActiveTab("lookup")}
            onExploreRecipes={() => setActiveTab("recipes")}
          />
        )}

        {activeTab === "reserve" && (
          <ReservationWizardView
            onReservationSuccess={(res) => {
              setConfirmedReservation(res);
              refreshAllData();
            }}
            addToast={addToast}
          />
        )}

        {activeTab === "lookup" && (
          <ReservationLookupView
            onCancelSuccess={() => {
              addToast("Reservation cancelled successfully", "success");
              refreshAllData();
            }}
            addToast={addToast}
          />
        )}

        {activeTab === "host" && (
          <HostDashboardView
            tables={tables}
            reservations={reservations}
            waitlist={waitlist}
            token={token}
            addToast={addToast}
            onOpenCreateOrder={(tbl) => {
              setSelectedTableForOrder(tbl);
              setIsCreateOrderModalOpen(true);
            }}
            onRefresh={refreshAllData}
          />
        )}

        {activeTab === "kitchen" && (
          <KitchenBoardView
            lanes={kitchenLanes}
            token={token}
            addToast={addToast}
            onOpenPrintKOT={(order) => setActiveKOTOrder(order)}
            onRefresh={refreshAllData}
          />
        )}

        {activeTab === "recipes" && (
          <RecipeExplorerView
            onSelectRecipe={(recipe) => setSelectedRecipe(recipe)}
            addToast={addToast}
          />
        )}

        {activeTab === "admin" && (
          <AdminAnalyticsLogsView
            analytics={analytics}
            auditLogs={auditLogs}
            systemLogs={systemLogs}
            onRefresh={refreshAllData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">DineDesk Operations Console</span>
            <span>·</span>
            <span>Project 05 | Restaurant Operations & Kitchen Order Display</span>
          </div>
          <div className="flex items-center gap-6">
            <span>SQLite3 ACID WAL Engine</span>
            <span>•</span>
            <span>TheMealDB API Integrated</span>
            <span>•</span>
            <span>Render Cloud Ready</span>
          </div>
        </div>
      </footer>

      {/* ----------------- MODALS ----------------- */}

      {/* Login Modal */}
      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={(u, t) => {
            saveAuth(u, t);
            setIsLoginModalOpen(false);
            addToast(`Welcome back, ${u.name}!`, "success");
            if (u.role === "host") setActiveTab("host");
            else if (u.role === "kitchen") setActiveTab("kitchen");
            else if (u.role === "admin") setActiveTab("admin");
          }}
          addToast={addToast}
        />
      )}

      {/* Reservation Confirmation Modal */}
      {confirmedReservation && (
        <ReservationConfirmationModal
          reservation={confirmedReservation}
          onClose={() => setConfirmedReservation(null)}
        />
      )}

      {/* Create Order Modal */}
      {isCreateOrderModalOpen && (
        <CreateOrderModal
          table={selectedTableForOrder}
          tables={tables}
          menuItems={menuItems}
          token={token}
          onClose={() => {
            setIsCreateOrderModalOpen(false);
            setSelectedTableForOrder(null);
          }}
          onSuccess={() => {
            setIsCreateOrderModalOpen(false);
            setSelectedTableForOrder(null);
            addToast("Order sent to kitchen console successfully!", "success");
            refreshAllData();
          }}
          addToast={addToast}
        />
      )}

      {/* Printable KOT Modal */}
      {activeKOTOrder && (
        <PrintKOTModal
          order={activeKOTOrder}
          onClose={() => setActiveKOTOrder(null)}
        />
      )}

      {/* External Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: LandingView
// -------------------------------------------------------------
function LandingView({ menuItems, onBookClick, onLookupClick, onExploreRecipes }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [dietFilter, setDietFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const categories = [
    { id: "all", label: "Full Menu" },
    { id: "appetizers", label: "Appetizers" },
    { id: "mains", label: "Mains" },
    { id: "specials", label: "Chef's Specials" },
    { id: "desserts", label: "Desserts" },
    { id: "beverages", label: "Beverages & Cocktails" },
  ];

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCategory === "all" || item.category === selectedCategory;
      const matchSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchDiet =
        dietFilter === "all" ||
        (item.dietary_tags && item.dietary_tags.toLowerCase().includes(dietFilter.toLowerCase()));
      return matchCat && matchSearch && matchDiet;
    });
  }, [menuItems, selectedCategory, dietFilter, searchTerm]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-2xl p-8 sm:p-14 border border-slate-800">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#b8775b_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-semibold uppercase tracking-wider">
            <span>✨</span> Artisan Dining & Kitchen Precision
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Seamless Dining Experience, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-amber-300">
              Synchronized Front-to-Back.
            </span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Reserve your table with guaranteed capacity validation, explore our wood-fired seasonal menu,
            and observe front-of-house hospitality connected directly to our live kitchen order console.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              onClick={onBookClick}
              className="px-6 py-3.5 bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white font-semibold rounded-2xl shadow-lg shadow-brand-600/30 transition-smooth flex items-center gap-2"
            >
              <Icon name="calendar-check" size={18} />
              Book a Table Online
            </button>
            <button
              onClick={onLookupClick}
              className="px-6 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl border border-slate-700 transition-smooth flex items-center gap-2"
            >
              <Icon name="search" size={18} />
              Find My Reservation
            </button>
            <button
              onClick={onExploreRecipes}
              className="px-6 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold rounded-2xl border border-slate-700 transition-smooth flex items-center gap-2"
            >
              <Icon name="sparkles" size={18} />
              Chef Recipe Explorer (TheMealDB)
            </button>
          </div>
        </div>
      </div>

      {/* Menu Header & Search / Filters */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Culinary Offerings</h2>
            <p className="text-sm text-slate-500 mt-1">
              Crafted fresh daily with locally sourced ingredients and dry-aged specialties.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Icon name="search" size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search dishes, ingredients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth shadow-sm"
            />
          </div>
        </div>

        {/* Category Tabs & Dietary Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-smooth ${
                  selectedCategory === c.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Dietary:</span>
            {["all", "Vegetarian", "Gluten-Free", "Pescatarian"].map((d) => (
              <button
                key={d}
                onClick={() => setDietFilter(d)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-smooth ${
                  dietFilter === d ? "bg-brand-100 text-brand-800 font-semibold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {d === "all" ? "All Diets" : d}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-smooth flex flex-col"
            >
              {item.image_url && (
                <div className="h-44 w-full overflow-hidden relative bg-slate-100">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-slate-900 shadow-sm">
                    ${item.price.toFixed(2)}
                  </div>
                  {item.category === "specials" && (
                    <div className="absolute top-3 left-3 bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      Chef Special
                    </div>
                  )}
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-700 transition-smooth">
                      {item.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Icon name="clock" size={13} />
                    {item.prep_time_minutes} min prep
                  </span>
                  {item.dietary_tags && (
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {item.dietary_tags}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <Icon name="utensils" size={32} className="text-slate-300 mx-auto mb-3" />
            <div className="text-base font-semibold text-slate-800">No dishes match your filter</div>
            <p className="text-xs text-slate-500 mt-1">Try clearing your search keyword or selecting "Full Menu".</p>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: ReservationWizardView
// -------------------------------------------------------------
function ReservationWizardView({ onReservationSuccess, addToast }) {
  const [partySize, setPartySize] = useState(2);
  const [resDate, setResDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [resTime, setResTime] = useState("18:30");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");

  const [isChecking, setIsChecking] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeSlots = [
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
  ];

  // Live Capacity Check
  const handleCheckCapacity = async () => {
    setIsChecking(true);
    setAvailabilityResult(null);
    const res = await api.get(`/api/tables/availability?date=${resDate}&time=${resTime}&party_size=${partySize}`);
    setIsChecking(false);
    if (res.ok) {
      setAvailabilityResult(res.data);
      if (res.data.available) {
        addToast(res.data.message, "success");
      } else {
        addToast(res.data.message, "error");
      }
    } else {
      addToast(res.data.error || "Failed to check capacity", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !phone) {
      addToast("Please fill in your name, email, and phone number", "error");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      party_size: partySize,
      reservation_date: resDate,
      reservation_time: resTime,
      special_requests: requests,
    };

    const res = await api.post("/api/reservations", payload);
    setIsSubmitting(false);

    if (res.ok) {
      addToast("Reservation successfully placed and table assigned!", "success");
      onReservationSuccess(res.data.reservation);
    } else {
      addToast(res.data.error || "Reservation failed", "error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Reserve Your Table</h2>
        <p className="text-sm text-slate-500 mt-1">
          Instant capacity validation automatically confirms and assigns the ideal table for your party.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Seating & Time */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Icon name="clock" size={14} />
              Step 1: Party Size, Date & Service Slot
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Party Size */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Guests (Party Size)</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                  <button
                    type="button"
                    onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition-smooth"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-sm text-slate-900">{partySize} Guests</span>
                  <button
                    type="button"
                    onClick={() => setPartySize((p) => Math.min(12, p + 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition-smooth"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={resDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    setResDate(e.target.value);
                    setAvailabilityResult(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth font-medium"
                />
              </div>

              {/* Time Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Time Slot</label>
                <select
                  value={resTime}
                  onChange={(e) => {
                    setResTime(e.target.value);
                    setAvailabilityResult(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth font-medium"
                >
                  {timeSlots.map((s) => (
                    <option key={s} value={s}>
                      {s} ({parseInt(s.split(":")[0]) < 16 ? "Lunch" : "Dinner"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Check Table Capacity Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCheckCapacity}
                disabled={isChecking}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-smooth flex items-center gap-1.5"
              >
                <Icon name="check-check" size={14} />
                {isChecking ? "Validating Capacity..." : "Check Table Availability"}
              </button>

              {availabilityResult && (
                <div
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                    availabilityResult.available
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  <Icon name={availabilityResult.available ? "check" : "x"} size={14} />
                  {availabilityResult.message}
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Section 2: Contact Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Icon name="user" size={14} />
              Step 2: Contact Information & Special Requests
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Dietary Allergies or Seating Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Birthday anniversary, high chair needed, severe nut allergy..."
                value={requests}
                onChange={(e) => setRequests(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-smooth"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-500 hover:to-amber-500 text-white font-bold rounded-2xl shadow-lg shadow-brand-600/20 transition-smooth flex items-center justify-center gap-2 text-base"
            >
              <Icon name="shield-check" size={18} />
              {isSubmitting ? "Confirming Table..." : "Complete Reservation & Generate Code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: ReservationConfirmationModal
// -------------------------------------------------------------
function ReservationConfirmationModal({ reservation, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Icon name="check" size={32} />
        </div>

        <div>
          <h3 className="text-2xl font-bold text-slate-900">Reservation Confirmed!</h3>
          <p className="text-xs text-slate-500 mt-1">
            Your table has been reserved in DineDesk's operational floor plan.
          </p>
        </div>

        {/* Confirmation Code Card */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirmation Code</span>
          <div className="text-2xl font-extrabold tracking-widest text-brand-700 font-mono">
            {reservation.confirmation_code}
          </div>
          <p className="text-[11px] text-slate-400">Save this code to check in or modify your reservation.</p>
        </div>

        {/* Booking Details Roster */}
        <div className="text-left bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Guest:</span>
            <span className="font-semibold text-slate-800">{reservation.customer_name}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Date & Slot:</span>
            <span className="font-semibold text-slate-800">
              {reservation.reservation_date} at {reservation.reservation_time}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Party Size:</span>
            <span className="font-semibold text-slate-800">{reservation.party_size} Guests</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Assigned Table:</span>
            <span className="font-semibold text-brand-700">
              {reservation.table_number} ({reservation.table_location})
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-smooth"
        >
          Done & Close
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: ReservationLookupView
// -------------------------------------------------------------
function ReservationLookupView({ onCancelSuccess, addToast }) {
  const [searchCode, setSearchCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundReservation, setFoundReservation] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;

    setIsSearching(true);
    setFoundReservation(null);
    const res = await api.get(`/api/reservations/${searchCode.trim()}`);
    setIsSearching(false);

    if (res.ok) {
      setFoundReservation(res.data.reservation);
    } else {
      addToast(res.data.error || "Reservation not found", "error");
    }
  };

  const handleCancelBooking = async () => {
    if (!foundReservation) return;
    if (!confirm(`Are you sure you want to cancel reservation ${foundReservation.confirmation_code}?`)) return;

    setIsCancelling(true);
    const res = await api.post(`/api/reservations/${foundReservation.confirmation_code}/cancel`, {});
    setIsCancelling(false);

    if (res.ok) {
      setFoundReservation((prev) => ({ ...prev, status: "cancelled" }));
      onCancelSuccess();
    } else {
      addToast(res.data.error || "Failed to cancel reservation", "error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Manage Your Reservation</h2>
        <p className="text-sm text-slate-500 mt-1">
          Look up an existing booking using your 6-digit reference code to view status or cancel.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
        <form onSubmit={handleLookup} className="flex gap-3">
          <input
            type="text"
            required
            placeholder="Enter confirmation code (e.g. DD-9482-XK)"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono font-medium uppercase"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-smooth flex items-center gap-2"
          >
            <Icon name="search" size={16} />
            {isSearching ? "Searching..." : "Lookup"}
          </button>
        </form>
      </div>

      {foundReservation && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirmation</span>
              <div className="text-xl font-bold font-mono text-brand-700">{foundReservation.confirmation_code}</div>
            </div>
            <span
              className={`px-3 py-1 text-xs font-bold uppercase rounded-lg ${
                foundReservation.status === "confirmed"
                  ? "bg-emerald-100 text-emerald-800"
                  : foundReservation.status === "seated"
                  ? "bg-sky-100 text-sky-800"
                  : foundReservation.status === "completed"
                  ? "bg-slate-100 text-slate-700"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {foundReservation.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Primary Guest</span>
              <div className="font-semibold text-slate-800 mt-0.5">{foundReservation.customer_name}</div>
            </div>
            <div>
              <span className="text-slate-400">Party Size</span>
              <div className="font-semibold text-slate-800 mt-0.5">{foundReservation.party_size} Guests</div>
            </div>
            <div>
              <span className="text-slate-400">Date</span>
              <div className="font-semibold text-slate-800 mt-0.5">{foundReservation.reservation_date}</div>
            </div>
            <div>
              <span className="text-slate-400">Time Slot</span>
              <div className="font-semibold text-slate-800 mt-0.5">{foundReservation.reservation_time}</div>
            </div>
            <div>
              <span className="text-slate-400">Assigned Table</span>
              <div className="font-semibold text-slate-800 mt-0.5">
                Table {foundReservation.table_number || "TBD"} ({foundReservation.table_location || "Indoor"})
              </div>
            </div>
            <div>
              <span className="text-slate-400">Phone Contact</span>
              <div className="font-semibold text-slate-800 mt-0.5">{foundReservation.customer_phone}</div>
            </div>
          </div>

          {foundReservation.special_requests && (
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-100">
              <span className="font-semibold text-slate-700">Special Requests: </span>
              {foundReservation.special_requests}
            </div>
          )}

          {foundReservation.status === "confirmed" && (
            <div className="pt-2">
              <button
                onClick={handleCancelBooking}
                disabled={isCancelling}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl border border-rose-200 transition-smooth flex items-center justify-center gap-2 text-xs"
              >
                <Icon name="x-circle" size={16} />
                {isCancelling ? "Cancelling Booking..." : "Cancel This Reservation"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: HostDashboardView
// -------------------------------------------------------------
function HostDashboardView({ tables, reservations, waitlist, token, addToast, onOpenCreateOrder, onRefresh }) {
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Waitlist form
  const [wlName, setWlName] = useState("");
  const [wlPhone, setWlPhone] = useState("");
  const [wlParty, setWlParty] = useState(2);
  const [wlNotes, setWlNotes] = useState("");

  const handleUpdateTableStatus = async (tableId, newStatus) => {
    const res = await api.patch(`/api/tables/${tableId}/status`, { status: newStatus }, token);
    if (res.ok) {
      addToast(res.data.message, "success");
      onRefresh();
    } else {
      addToast(res.data.error || "Failed to update table status", "error");
    }
  };

  const handleUpdateReservationStatus = async (resId, newStatus) => {
    const res = await api.patch(`/api/reservations/${resId}/status`, { status: newStatus }, token);
    if (res.ok) {
      addToast(`Reservation marked as ${newStatus}`, "success");
      onRefresh();
    } else {
      addToast(res.data.error || "Failed to update reservation", "error");
    }
  };

  const handleAddWaitlist = async (e) => {
    e.preventDefault();
    if (!wlName || !wlPhone) return;

    const res = await api.post(
      "/api/waitlist",
      { customer_name: wlName, customer_phone: wlPhone, party_size: wlParty, notes: wlNotes },
      token
    );
    if (res.ok) {
      addToast("Added to waitlist", "success");
      setWlName("");
      setWlPhone("");
      setWlNotes("");
      onRefresh();
    } else {
      addToast(res.data.error || "Failed to add to waitlist", "error");
    }
  };

  const handleUpdateWaitlistStatus = async (wlId, newStatus) => {
    const res = await api.patch(`/api/waitlist/${wlId}/status`, { status: newStatus }, token);
    if (res.ok) {
      addToast(res.data.message, "success");
      onRefresh();
    }
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const matchDate = !filterDate || r.reservation_date === filterDate;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchSearch =
        !searchTerm ||
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.confirmation_code.toLowerCase().includes(searchTerm.toLowerCase());
      return matchDate && matchStatus && matchSearch;
    });
  }, [reservations, filterDate, statusFilter, searchTerm]);

  return (
    <div className="space-y-10">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Host Operations Console</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time floor occupancy, table seating allocation, reservation intake, and walk-in waitlist.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-smooth flex items-center gap-2 self-start"
        >
          <Icon name="refresh-cw" size={14} />
          Sync Floor State
        </button>
      </div>

      {/* ---------------- Floor Plan / Table Cards ---------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon name="grid" size={18} className="text-brand-600" />
            Floor Plan & Table Status
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Available
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reserved
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Occupied
            </span>
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Cleaning
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {tables.map((tbl) => {
            const isOccupied = tbl.status === "occupied";
            const isReserved = tbl.status === "reserved";
            const isCleaning = tbl.status === "cleaning";
            const isAvailable = tbl.status === "available";

            const borderClass = isAvailable
              ? "border-emerald-200 bg-emerald-50/30"
              : isReserved
              ? "border-amber-200 bg-amber-50/30"
              : isOccupied
              ? "border-indigo-200 bg-indigo-50/40"
              : "border-slate-200 bg-slate-50/50";

            return (
              <div
                key={tbl.id}
                className={`rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-smooth ${borderClass}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900 font-mono">{tbl.table_number}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isAvailable
                          ? "bg-emerald-100 text-emerald-800"
                          : isReserved
                          ? "bg-amber-100 text-amber-800"
                          : isOccupied
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {tbl.status}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Capacity:</span>
                      <span className="font-semibold text-slate-700">
                        {tbl.min_capacity} - {tbl.capacity} Seats
                      </span>
                    </div>
                    <div className="flex justify-between capitalize">
                      <span>Location:</span>
                      <span className="font-semibold text-slate-700">{tbl.location}</span>
                    </div>
                    {tbl.current_guest && (
                      <div className="pt-2 border-t border-slate-200/60 text-slate-800 font-medium truncate">
                        👤 {tbl.current_guest} ({tbl.current_party_size}p)
                      </div>
                    )}
                  </div>
                </div>

                {/* Table Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                  {isAvailable && (
                    <button
                      onClick={() => handleUpdateTableStatus(tbl.id, "occupied")}
                      className="flex-1 py-1 px-2 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-smooth"
                    >
                      Seat Walk-in
                    </button>
                  )}
                  {isOccupied && (
                    <>
                      <button
                        onClick={() => onOpenCreateOrder(tbl)}
                        className="flex-1 py-1 px-2 text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-smooth flex items-center justify-center gap-1"
                      >
                        <Icon name="plus" size={12} />
                        Order
                      </button>
                      <button
                        onClick={() => handleUpdateTableStatus(tbl.id, "cleaning")}
                        className="py-1 px-2 text-[11px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-smooth"
                      >
                        Bus / Free
                      </button>
                    </>
                  )}
                  {isCleaning && (
                    <button
                      onClick={() => handleUpdateTableStatus(tbl.id, "available")}
                      className="flex-1 py-1 px-2 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-smooth"
                    >
                      Ready for Seating
                    </button>
                  )}
                  {isReserved && (
                    <button
                      onClick={() => handleUpdateTableStatus(tbl.id, "occupied")}
                      className="flex-1 py-1 px-2 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-smooth"
                    >
                      Seat Reservation
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- Reservation Roster & Filter ---------------- */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon name="calendar" size={18} className="text-brand-600" />
            Guest Reservation Roster
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="seated">Seated</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="text"
              placeholder="Search guest or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium w-48"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Ref Code</th>
                  <th className="p-4">Guest Name</th>
                  <th className="p-4">Slot</th>
                  <th className="p-4">Party</th>
                  <th className="p-4">Table</th>
                  <th className="p-4">Special Requests</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Host Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReservations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-smooth">
                    <td className="p-4 font-mono font-bold text-brand-700">{r.confirmation_code}</td>
                    <td className="p-4 font-semibold text-slate-800">
                      <div>{r.customer_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{r.customer_phone}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-700">{r.reservation_time}</td>
                    <td className="p-4 text-slate-600">{r.party_size} Guests</td>
                    <td className="p-4 font-mono text-slate-700">{r.table_number || "TBD"}</td>
                    <td className="p-4 text-slate-500 max-w-xs truncate">{r.special_requests || "—"}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          r.status === "confirmed"
                            ? "bg-amber-100 text-amber-800"
                            : r.status === "seated"
                            ? "bg-indigo-100 text-indigo-800"
                            : r.status === "completed"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      {r.status === "confirmed" && (
                        <button
                          onClick={() => handleUpdateReservationStatus(r.id, "seated")}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-smooth"
                        >
                          Seat & Check In
                        </button>
                      )}
                      {r.status === "seated" && (
                        <button
                          onClick={() => handleUpdateReservationStatus(r.id, "completed")}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-smooth"
                        >
                          Checkout
                        </button>
                      )}
                      {r.status === "confirmed" && (
                        <button
                          onClick={() => handleUpdateReservationStatus(r.id, "cancelled")}
                          className="px-2 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-smooth"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredReservations.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No reservations found for the selected date & filter.
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Waitlist Section ---------------- */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Icon name="users" size={18} className="text-brand-600" />
          Walk-in Waitlist Queue
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add to waitlist form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Add Walk-in Party</h4>
            <form onSubmit={handleAddWaitlist} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Green"
                  value={wlName}
                  onChange={(e) => setWlName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+1 555-0123"
                    value={wlPhone}
                    onChange={(e) => setWlPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Party Size</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={wlParty}
                    onChange={(e) => setWlParty(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Preferences</label>
                <input
                  type="text"
                  placeholder="e.g. Outdoor patio preferred"
                  value={wlNotes}
                  onChange={(e) => setWlNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-smooth"
              >
                Add to Waitlist
              </button>
            </form>
          </div>

          {/* Waitlist cards */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {waitlist.map((w) => (
              <div
                key={w.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">{w.customer_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        w.status === "waiting" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    <div>Party: <span className="font-semibold text-slate-700">{w.party_size} Guests</span></div>
                    <div>Phone: <span className="font-semibold text-slate-700">{w.customer_phone}</span></div>
                    {w.notes && <div className="italic text-slate-400">"{w.notes}"</div>}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                  {w.status === "waiting" && (
                    <button
                      onClick={() => handleUpdateWaitlistStatus(w.id, "notified")}
                      className="flex-1 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg transition-smooth"
                    >
                      Notify SMS
                    </button>
                  )}
                  <button
                    onClick={() => handleUpdateWaitlistStatus(w.id, "seated")}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-smooth"
                  >
                    Seat Party
                  </button>
                  <button
                    onClick={() => handleUpdateWaitlistStatus(w.id, "cancelled")}
                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-smooth"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            {waitlist.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 text-xs flex items-center justify-center">
                Waitlist is currently empty.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: KitchenBoardView
// -------------------------------------------------------------
function KitchenBoardView({ lanes, token, addToast, onOpenPrintKOT, onRefresh }) {
  const handleAdvanceStatus = async (orderId, newStatus) => {
    const res = await api.patch(`/api/orders/${orderId}/status`, { status: newStatus }, token);
    if (res.ok) {
      addToast(res.data.message, "success");
      onRefresh();
    } else {
      addToast(res.data.error || "Failed to update status", "error");
    }
  };

  const laneMeta = [
    { key: "new", title: "New Orders", color: "border-rose-400 bg-rose-50/20 text-rose-800", count: lanes.new.length },
    { key: "preparing", title: "Preparing (In Fire)", color: "border-amber-400 bg-amber-50/20 text-amber-800", count: lanes.preparing.length },
    { key: "ready", title: "Ready for Pass", color: "border-emerald-400 bg-emerald-50/20 text-emerald-800", count: lanes.ready.length },
    { key: "served", title: "Delivered & Served", color: "border-slate-300 bg-slate-50/20 text-slate-600", count: lanes.served.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Kitchen Order Console (KDS)</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-lane line ticket console with prep countdowns, modifier notes, and thermal ticket printing.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-smooth flex items-center gap-2 self-start"
        >
          <Icon name="refresh-cw" size={14} />
          Refresh Lanes
        </button>
      </div>

      {/* Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {laneMeta.map((lane) => (
          <div key={lane.key} className="bg-slate-100/70 rounded-2xl p-3 border border-slate-200/80 space-y-3">
            {/* Lane Header */}
            <div className={`p-2.5 rounded-xl border bg-white flex items-center justify-between font-bold text-xs ${lane.color}`}>
              <span>{lane.title}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-mono">
                {lane.count}
              </span>
            </div>

            {/* Orders in this lane */}
            <div className="space-y-3 min-h-[300px]">
              {(lanes[lane.key] || []).map((order) => {
                const isDelayed = order.elapsed_minutes > 15 && lane.key !== "served";
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-smooth space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-mono font-bold text-sm text-slate-900">{order.order_number}</span>
                        <div className="text-[11px] font-semibold text-brand-700">Table {order.table_number}</div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isDelayed ? "bg-rose-100 text-rose-800 animate-pulse" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          ⏱️ {order.elapsed_minutes}m ago
                        </span>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-1.5 text-xs">
                      {order.items?.map((it) => (
                        <div key={it.id} className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-slate-800 mr-1.5 font-mono">{it.quantity}x</span>
                            <span className="font-medium text-slate-700">{it.item_name}</span>
                            {it.notes && (
                              <div className="text-[10px] text-amber-700 italic pl-5 font-sans">
                                ↳ {it.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Notes */}
                    {order.notes && (
                      <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-800 border border-amber-200/50">
                        <span className="font-bold">Note: </span>
                        {order.notes}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenPrintKOT(order)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                        title="Print Kitchen Ticket"
                      >
                        <Icon name="printer" size={14} />
                      </button>

                      {lane.key === "new" && (
                        <button
                          onClick={() => handleAdvanceStatus(order.id, "preparing")}
                          className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-smooth"
                        >
                          🔥 Fire Ticket
                        </button>
                      )}

                      {lane.key === "preparing" && (
                        <button
                          onClick={() => handleAdvanceStatus(order.id, "ready")}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-smooth"
                        >
                          ✓ Pass to Service
                        </button>
                      )}

                      {lane.key === "ready" && (
                        <button
                          onClick={() => handleAdvanceStatus(order.id, "served")}
                          className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-smooth"
                        >
                          🍽️ Mark Served
                        </button>
                      )}

                      {lane.key === "served" && (
                        <span className="text-[11px] text-emerald-600 font-semibold mx-auto flex items-center gap-1">
                          <Icon name="check-circle" size={13} /> Complete
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {(lanes[lane.key] || []).length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 bg-white/50 rounded-xl border border-dashed border-slate-200">
                  No orders in this lane.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: RecipeExplorerView (TheMealDB Integration)
// -------------------------------------------------------------
function RecipeExplorerView({ onSelectRecipe, addToast }) {
  const [searchTerm, setSearchTerm] = useState("Chicken");
  const [ingredientTerm, setIngredientTerm] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = async (term) => {
    setIsLoading(true);
    const res = await api.get(`/api/external/recipes?search=${encodeURIComponent(term)}`);
    setIsLoading(false);
    if (res.ok) {
      setRecipes(res.data.recipes || []);
    } else {
      addToast("Failed to fetch recipes from external service", "error");
    }
  };

  const performIngredientSearch = async (ing) => {
    if (!ing) return;
    setIsLoading(true);
    const res = await api.get(`/api/external/recipes/ingredient?ingredient=${encodeURIComponent(ing)}`);
    setIsLoading(false);
    if (res.ok) {
      setRecipes(res.data.recipes || []);
    } else {
      addToast("Failed to search by ingredient", "error");
    }
  };

  useEffect(() => {
    performSearch("Chicken");
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-semibold mb-2">
          <span>🌐</span> Powered by TheMealDB Free Educational API
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Chef Inspiration & Recipe Explorer</h2>
        <p className="text-sm text-slate-500 mt-1">
          Explore global culinary recipes and preparation techniques for menu enrichment and kitchen reference.
        </p>
      </div>

      {/* Dual Search: Dish Name or Ingredient */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <input
            type="text"
            placeholder="Search dish by name (e.g. Pasta, Salmon, Curry)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
          <button
            onClick={() => performSearch(searchTerm)}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-smooth"
          >
            Search Dish
          </button>
        </div>

        {/* Ingredient Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
          <input
            type="text"
            placeholder="Search by ingredient (e.g. Garlic, Beef, Cheese)..."
            value={ingredientTerm}
            onChange={(e) => setIngredientTerm(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
          <button
            onClick={() => performIngredientSearch(ingredientTerm)}
            disabled={isLoading}
            className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-semibold text-xs rounded-xl transition-smooth"
          >
            By Ingredient
          </button>
        </div>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelectRecipe(r)}
            className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-smooth cursor-pointer flex flex-col"
          >
            {r.thumbnail && (
              <div className="h-48 overflow-hidden bg-slate-100">
                <img
                  src={r.thumbnail}
                  alt={r.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                />
              </div>
            )}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                  <span>{r.area || "International"}</span>
                  <span>•</span>
                  <span>{r.category || "Dish"}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mt-1 group-hover:text-brand-700 transition-smooth">
                  {r.name}
                </h3>
                {r.instructions && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                    {r.instructions}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-brand-600 font-semibold">
                <span>View Full Recipe & Measurements</span>
                <Icon name="arrow-right" size={14} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {recipes.length === 0 && !isLoading && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <Icon name="search" size={32} className="text-slate-300 mx-auto mb-3" />
          <div className="text-base font-semibold text-slate-800">No recipes found</div>
          <p className="text-xs text-slate-500 mt-1">Try another keyword or common ingredient.</p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: AdminAnalyticsLogsView
// -------------------------------------------------------------
function AdminAnalyticsLogsView({ analytics, auditLogs, systemLogs, onRefresh }) {
  const [activeLogTab, setActiveLogTab] = useState("audit");

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Management & System Observability</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time table occupancy KPIs, audit trail enforcement, and live server logs for demonstration.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-smooth flex items-center gap-2 self-start"
        >
          <Icon name="refresh-cw" size={14} />
          Refresh Metrics
        </button>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Table Utilization Rate</span>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">{analytics.utilization_rate}%</div>
            <p className="text-xs text-slate-500 mt-1">
              {analytics.occupied_tables} of {analytics.total_tables} tables occupied
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Reservations</span>
            <div className="text-3xl font-extrabold text-brand-700 mt-2">{analytics.today_reservations}</div>
            <p className="text-xs text-slate-500 mt-1">Active bookings on today's roster</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Kitchen Orders</span>
            <div className="text-3xl font-extrabold text-amber-600 mt-2">{analytics.active_orders}</div>
            <p className="text-xs text-slate-500 mt-1">Orders in new, prep, or pass lanes</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Simulated Revenue</span>
            <div className="text-3xl font-extrabold text-emerald-700 mt-2">${analytics.served_revenue.toFixed(2)}</div>
            <p className="text-xs text-slate-500 mt-1">Total value of completed orders</p>
          </div>
        </div>
      )}

      {/* Observability / Logs Streams */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab switch */}
        <div className="border-b border-slate-200 p-4 bg-slate-50 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveLogTab("audit")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-smooth ${
                activeLogTab === "audit" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              📋 Business Audit Trail ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveLogTab("system")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-smooth ${
                activeLogTab === "system" ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              💻 Live Backend Server Stream ({systemLogs.length})
            </button>
          </div>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:block">Sanitized & Safe for Viva Demo</span>
        </div>

        {/* Audit Log Table */}
        {activeLogTab === "audit" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Entity</th>
                  <th className="p-3.5">Performed By</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">{log.created_at}</td>
                    <td className="p-3.5 font-bold text-slate-800">{log.action}</td>
                    <td className="p-3.5 text-brand-700">{log.entity_type} #{log.entity_id}</td>
                    <td className="p-3.5 text-slate-700 font-sans">{log.user_name || "Guest / System"}</td>
                    <td className="p-3.5 text-slate-600 font-sans">{log.details}</td>
                    <td className="p-3.5 text-slate-400">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* System Server Stream */}
        {activeLogTab === "system" && (
          <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto space-y-1">
            {systemLogs.map((entry, idx) => (
              <div key={idx} className="flex gap-2 leading-relaxed">
                <span className="text-slate-500 shrink-0">[{entry.timestamp}]</span>
                <span
                  className={`font-bold shrink-0 ${
                    entry.level === "ERROR"
                      ? "text-rose-400"
                      : entry.level === "WARNING"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  [{entry.level}]
                </span>
                <span className="text-slate-200">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: CreateOrderModal
// -------------------------------------------------------------
function CreateOrderModal({ table, tables, menuItems, token, onClose, onSuccess, addToast }) {
  const [selectedTableId, setSelectedTableId] = useState(table ? table.id : (tables[0]?.id || 1));
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQtyChange = (menuItemId, change) => {
    setOrderItemsMap((prev) => {
      const current = prev[menuItemId] || 0;
      const updated = Math.max(0, current + change);
      const copy = { ...prev };
      if (updated === 0) delete copy[menuItemId];
      else copy[menuItemId] = updated;
      return copy;
    });
  };

  const calculatedTotal = useMemo(() => {
    let sum = 0;
    Object.entries(orderItemsMap).forEach(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === parseInt(itemId));
      if (item) sum += item.price * qty;
    });
    return sum;
  }, [orderItemsMap, menuItems]);

  const handleSubmitOrder = async () => {
    const itemsArray = Object.entries(orderItemsMap).map(([menuItemId, qty]) => ({
      menu_item_id: parseInt(menuItemId),
      quantity: qty,
      notes: "",
    }));

    if (itemsArray.length === 0) {
      addToast("Please select at least one menu item", "error");
      return;
    }

    setIsSubmitting(true);
    const res = await api.post(
      "/api/orders",
      { table_id: selectedTableId, items: itemsArray, notes: orderNotes },
      token
    );
    setIsSubmitting(false);

    if (res.ok) {
      onSuccess();
    } else {
      addToast(res.data.error || "Failed to create order", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Punch Table Order</h3>
            <p className="text-xs text-slate-500">Dispatch directly to Kitchen Display Console</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Table select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Table</label>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.table_number} ({t.location}, {t.capacity} seats, Status: {t.status})
                </option>
              ))}
            </select>
          </div>

          {/* Menu items list */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Select Dishes & Drinks</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {menuItems.map((m) => {
                const qty = orderItemsMap[m.id] || 0;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{m.name}</span>
                      <span className="text-slate-400 ml-2">${m.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQtyChange(m.id, -1)}
                        className="w-6 h-6 rounded bg-white border border-slate-200 font-bold"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold font-mono">{qty}</span>
                      <button
                        onClick={() => handleQtyChange(m.id, 1)}
                        className="w-6 h-6 rounded bg-white border border-slate-200 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kitchen Modifiers / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Steak medium-rare, dressing on side..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Order Subtotal</span>
            <div className="text-lg font-bold text-slate-900">${calculatedTotal.toFixed(2)}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || calculatedTotal === 0}
              className="px-6 py-2.5 text-xs font-bold text-white bg-brand-700 hover:bg-brand-800 rounded-xl transition-smooth shadow-sm"
            >
              {isSubmitting ? "Dispatching..." : "Send to Kitchen Board"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: PrintKOTModal (Printable Kitchen Order Ticket)
// -------------------------------------------------------------
function PrintKOTModal({ order, onClose }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        {/* Screen preview */}
        <div id="printable-kot" className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs space-y-3">
          <div className="text-center border-b border-dashed border-slate-400 pb-2">
            <div className="font-extrabold text-sm uppercase">DINEDESK KITCHEN</div>
            <div className="text-[10px] text-slate-500">KITCHEN ORDER TICKET (KOT)</div>
          </div>

          <div className="flex justify-between text-[11px]">
            <span>ORDER: {order.order_number}</span>
            <span className="font-bold">TABLE: {order.table_number}</span>
          </div>
          <div className="text-[10px] text-slate-500">TIME: {order.created_at || "Now"}</div>

          <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1">
            {order.items?.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span>{it.quantity}x {it.item_name}</span>
              </div>
            ))}
          </div>

          {order.notes && (
            <div className="text-[11px] font-bold text-slate-800 bg-white p-2 rounded border border-slate-200">
              MODIFIER: {order.notes}
            </div>
          )}

          <div className="text-center text-[10px] text-slate-400 pt-1">
            *** EXPEDITE TICKET ***
          </div>
        </div>

        <div className="flex gap-2 no-print">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 text-xs font-bold bg-slate-900 text-white rounded-xl flex items-center justify-center gap-1.5"
          >
            <Icon name="printer" size={14} />
            Print Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: RecipeDetailModal
// -------------------------------------------------------------
function RecipeDetailModal({ recipe, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col space-y-4">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
              {recipe.area} · {recipe.category}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{recipe.name}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {recipe.thumbnail && (
            <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-52 object-cover rounded-2xl" />
          )}

          {/* Ingredients list */}
          <div>
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">Ingredients</h4>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {recipe.ingredients?.map((ing, i) => (
                <div key={i} className="flex justify-between border-b border-slate-200/50 pb-1">
                  <span className="font-medium text-slate-700">{ing.name}</span>
                  <span className="text-slate-400">{ing.measure}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">Directions</h4>
            <p className="text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {recipe.instructions}
            </p>
          </div>

          {recipe.youtube_url && (
            <div className="pt-2">
              <a
                href={recipe.youtube_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-700 font-bold hover:underline"
              >
                <Icon name="video" size={14} /> Watch Preparation Video
              </a>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-900 text-white font-semibold text-xs rounded-xl"
        >
          Close Recipe
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Component: LoginModal
// -------------------------------------------------------------
function LoginModal({ onClose, onSuccess, addToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await api.post("/api/auth/login", { email, password });
    setIsSubmitting(false);

    if (res.ok) {
      onSuccess(res.data.user, res.data.token);
    } else {
      addToast(res.data.error || "Login failed", "error");
    }
  };

  const handleQuickFill = (demoEmail, demoPw) => {
    setEmail(demoEmail);
    setPassword(demoPw);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Staff Portal</h3>
            <p className="text-xs text-slate-500 mt-0.5">Role-based access for Host, Kitchen, and Admin</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* 1-Click Demo Credential Buttons */}
        <div className="p-3 bg-brand-50/60 rounded-2xl border border-brand-200/60 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-800">Demo 1-Click Credentials</div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickFill("host@dinedesk.com", "HostPass123!")}
              className="py-1.5 px-2 bg-white text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs"
            >
              🛎️ Host
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("kitchen@dinedesk.com", "KitchenPass123!")}
              className="py-1.5 px-2 bg-white text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs"
            >
              👨‍🍳 Kitchen
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("admin@dinedesk.com", "AdminPass123!")}
              className="py-1.5 px-2 bg-white text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs"
            >
              👔 Manager
            </button>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              placeholder="staff@dinedesk.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-smooth shadow-md"
          >
            {isSubmitting ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Mount React Root
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<DineDeskApp />);
}


document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    if (typeof supabaseClient === "undefined") {
        console.error("Supabase belum terhubung. Periksa js/supabase.js.");
        return;
    }

    let currentUser = null;
    let currentProfile = null;
    let publicJobs = [];

    // ==========================================
    // UTILITAS
    // ==========================================
    function escapeHTML(value = "") {
        return String(value).replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function formatSalary(min, max) {
        const format = (value) =>
            new Intl.NumberFormat("id-ID", {
                notation: "compact",
                maximumFractionDigits: 1
            }).format(value);

        if (min != null && max != null) {
            return `Rp ${format(min)} – Rp ${format(max)}`;
        }
        if (min != null) return `Mulai Rp ${format(min)}`;
        if (max != null) return `Hingga Rp ${format(max)}`;
        return "Gaji tidak dicantumkan";
    }

    function showMessage(id, message, type = "error") {
        const element = $(id);
        if (!element) return;

        element.textContent = message;
        element.className = `auth-message ${type}`;
    }

    function clearAuthMessages() {
        ["loginMessage", "registerMessage"].forEach((id) => {
            const element = $(id);
            if (element) {
                element.textContent = "";
                element.className = "auth-message";
            }
        });
    }

    // ==========================================
    // MODAL LOGIN DAN REGISTRASI
    // ==========================================
    const authModal = $("authModal");
    const loginForm = $("loginForm");
    const registerForm = $("registerForm");

    function showAuthForm(mode = "login") {
        if ($("loginFormContainer")) {
            $("loginFormContainer").style.display =
                mode === "login" ? "block" : "none";
        }

        if ($("registerFormContainer")) {
            $("registerFormContainer").style.display =
                mode === "register" ? "block" : "none";
        }

        clearAuthMessages();
    }

    function openAuthModal(mode = "login") {
        if (!authModal) {
            alert("Form login tidak ditemukan. Periksa index.html.");
            return;
        }

        authModal.classList.add("active");
        authModal.setAttribute("aria-hidden", "false");
        showAuthForm(mode);
    }

    function closeAuthModal() {
        if (!authModal) return;

        authModal.classList.remove("active");
        authModal.setAttribute("aria-hidden", "true");
    }

    $("loginBtn")?.addEventListener("click", () => openAuthModal("login"));
    $("registerBtn")?.addEventListener("click", () => openAuthModal("register"));
    $("showRegisterBtn")?.addEventListener("click", () => showAuthForm("register"));
    $("showLoginBtn")?.addEventListener("click", () => showAuthForm("login"));
    $("authClose")?.addEventListener("click", closeAuthModal);
    $("authModalOverlay")?.addEventListener("click", closeAuthModal);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAuthModal();
            closeJobModal();
        }
    });

    // ==========================================
    // LOGIN
    // ==========================================
    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = $("loginEmail")?.value.trim();
        const password = $("loginPassword")?.value;

        if (!email || !password) {
            showMessage("loginMessage", "Email dan password wajib diisi.");
            return;
        }

        const button = loginForm.querySelector('button[type="submit"]');

        if (button) {
            button.disabled = true;
            button.textContent = "Memproses...";
        }

        try {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) throw error;
            if (!data.user) throw new Error("Data akun tidak ditemukan.");

            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Login gagal:", error);
            showMessage("loginMessage", error.message || "Login gagal.");
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Masuk";
            }
        }
    });

    // ==========================================
    // REGISTRASI
    // ==========================================
    registerForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = $("registerName")?.value.trim();
        const email = $("registerEmail")?.value.trim();
        const password = $("registerPassword")?.value;
        const role = $("registerRole")?.value;

        if (!name || !email || !password || !role) {
            showMessage("registerMessage", "Semua kolom wajib diisi.");
            return;
        }

        if (!["job_seeker", "recruiter"].includes(role)) {
            showMessage("registerMessage", "Role yang dipilih tidak valid.");
            return;
        }

        if (password.length < 6) {
            showMessage("registerMessage", "Password minimal 6 karakter.");
            return;
        }

        const button = registerForm.querySelector('button[type="submit"]');

        if (button) {
            button.disabled = true;
            button.textContent = "Mendaftarkan...";
        }

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        role
                    }
                }
            });

            if (error) throw error;
            if (!data.user) throw new Error("Akun tidak berhasil dibuat.");

            if (!data.session) {
                showMessage(
                    "registerMessage",
                    "Akun berhasil dibuat. Periksa email untuk verifikasi, kemudian login.",
                    "success"
                );
                return;
            }

            window.location.href = "dashboard.html";
        } catch (error) {
            console.error("Registrasi gagal:", error);
            showMessage("registerMessage", error.message || "Registrasi gagal.");
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Daftar";
            }
        }
    });

    // ==========================================
    // PROFIL PENGGUNA
    // ==========================================
    async function getCurrentProfile(userId) {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, full_name, email, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;

        return data;
    }

    async function refreshCurrentUser() {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        currentUser = data.session?.user || null;
        currentProfile = null;

        if (currentUser) {
            currentProfile = await getCurrentProfile(currentUser.id);
        }

        return currentUser;
    }

    // ==========================================
    // NAVBAR DAN LOGOUT
    // ==========================================
    async function updateNavbar(session) {
        currentUser = session?.user || null;
        currentProfile = null;

        const loginButton = $("loginBtn");
        const registerButton = $("registerBtn");
        const existingInfo = $("userInfo");

        if (!currentUser) {
            if (loginButton) loginButton.style.display = "";
            if (registerButton) registerButton.style.display = "";
            const navActions = document.querySelector(".navbar .nav-actions");
            if (navActions) navActions.style.display = "";
            existingInfo?.remove();
            return;
        }

        try {
            currentProfile = await getCurrentProfile(currentUser.id);
        } catch (error) {
            console.error("Gagal membaca profil:", error);
        }

        if (loginButton) loginButton.style.display = "none";
        if (registerButton) registerButton.style.display = "none";

        let userInfo = $("userInfo");

        if (!userInfo) {
            userInfo = document.createElement("div");
            userInfo.id = "userInfo";
            userInfo.className = "user-info";

            const navbar = document.querySelector(".navbar .nav-container");
            const navActions = document.querySelector(".navbar .nav-actions");

            // Pisahkan info akun dari tombol Masuk/Daftar agar layout navbar rapi.
            if (navActions) navActions.style.display = "none";
            navbar?.appendChild(userInfo);
        }

        if (!userInfo) return;

        userInfo.replaceChildren();

        const name = document.createElement("strong");
        name.textContent =
            currentProfile?.full_name || currentUser.email || "Pengguna";

        const dashboardLink = document.createElement("a");
        dashboardLink.href = "dashboard.html";
        dashboardLink.className = "dashboard-nav-link";
        dashboardLink.textContent = "Dashboard";

        const logoutButton = document.createElement("button");
        logoutButton.type = "button";
        logoutButton.className = "btn btn-outline";
        logoutButton.textContent = "Logout";

        logoutButton.addEventListener("click", async () => {
            logoutButton.disabled = true;

            try {
                const { error } = await supabaseClient.auth.signOut();

                if (error) throw error;

                window.location.reload();
            } catch (error) {
                alert("Logout gagal: " + error.message);
                logoutButton.disabled = false;
            }
        });

        userInfo.append(name, dashboardLink, logoutButton);
    }

    // ==========================================
    // MODAL DETAIL LOWONGAN DAN FORM LAMARAN
    // ==========================================
    function createJobModal() {
        if ($("jobDetailModal")) return;

        const modal = document.createElement("div");
        modal.id = "jobDetailModal";
        modal.className = "job-detail-modal";
        modal.setAttribute("aria-hidden", "true");

        modal.innerHTML = `
            <div class="job-detail-overlay" data-close-job-modal></div>
            <section class="job-detail-dialog"
                role="dialog" aria-modal="true"
                aria-labelledby="jobDetailTitle">
                <button type="button" class="job-detail-close"
                    data-close-job-modal aria-label="Tutup">&times;</button>
                <div id="jobDetailContent">
                    <p>Memuat detail lowongan...</p>
                </div>
            </section>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll("[data-close-job-modal]").forEach((button) => {
            button.addEventListener("click", closeJobModal);
        });
    }

    function closeJobModal() {
        const modal = $("jobDetailModal");
        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    function openJobModal() {
        createJobModal();

        const modal = $("jobDetailModal");
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    function renderJobDetail(job) {
        const company = job.companies || {};
        const category = job.categories?.name || "Umum";
        const content = $("jobDetailContent");

        if (!content) return;

        content.innerHTML = `
            <div class="job-detail-heading">
                <span class="job-detail-category">${escapeHTML(category)}</span>
                <h2 id="jobDetailTitle">${escapeHTML(job.title)}</h2>
                <p class="job-detail-company">
                    ${escapeHTML(company.company_name || "Perusahaan")}
                </p>
            </div>

            <div class="job-detail-meta">
                <span>📍 ${escapeHTML(job.location || company.location || "Lokasi fleksibel")}</span>
                <span>💼 ${escapeHTML(job.job_type || "Tidak ditentukan")}</span>
                <span>🏢 ${escapeHTML(job.workplace_type || "On-site")}</span>
                <span>💰 ${escapeHTML(formatSalary(job.salary_min, job.salary_max))}</span>
            </div>

            <h3>Deskripsi pekerjaan</h3>
            <p class="job-detail-text">${escapeHTML(job.description || "Belum ada deskripsi.")}</p>

            <h3>Persyaratan</h3>
            <p class="job-detail-text">${escapeHTML(job.requirements || "Tidak dicantumkan.")}</p>

            <h3>Tanggung jawab</h3>
            <p class="job-detail-text">${escapeHTML(job.responsibilities || "Tidak dicantumkan.")}</p>

            <form id="applicationForm" class="application-form">
                <h3>Lamar pekerjaan ini</h3>
                <p class="application-note">
                    Isi surat lamaran dan tautan CV jika tersedia.
                </p>

                <label for="applicationCoverLetter">Surat lamaran</label>
                <textarea id="applicationCoverLetter" rows="5"
                    placeholder="Tuliskan alasan dan kualifikasi kamu..."
                    required maxlength="5000"></textarea>

                <label for="applicationCvUrl">Tautan CV (opsional)</label>
                <input id="applicationCvUrl" type="url"
                    placeholder="https://drive.google.com/..." maxlength="1000">

                <p id="applicationMessage" class="application-message"
                    role="status" aria-live="polite"></p>

                <button type="submit" id="submitApplicationBtn"
                    class="job-apply-btn">Kirim Lamaran</button>
            </form>
        `;

        $("applicationForm")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            await submitApplication(job.id);
        });
    }

    async function submitApplication(jobId) {
        const form = $("applicationForm");
        const button = $("submitApplicationBtn");
        const message = $("applicationMessage");

        if (!form || !button || !message) return;

        message.textContent = "";
        message.className = "application-message";

        try {
            await refreshCurrentUser();

            if (!currentUser) {
                closeJobModal();
                openAuthModal("login");
                showMessage(
                    "loginMessage",
                    "Login terlebih dahulu untuk melamar pekerjaan."
                );
                return;
            }

            if (!currentProfile) {
                throw new Error(
                    "Profil akun belum tersedia. Silakan login ulang atau periksa tabel profiles."
                );
            }

            if (currentProfile.role !== "job_seeker") {
                throw new Error(
                    "Hanya akun Job Seeker yang dapat mengirim lamaran."
                );
            }

            const coverLetter = $("applicationCoverLetter")?.value.trim();
            const cvUrl = $("applicationCvUrl")?.value.trim() || null;

            if (!coverLetter) {
                throw new Error("Surat lamaran wajib diisi.");
            }

            if (cvUrl) {
                let parsedUrl;

                try {
                    parsedUrl = new URL(cvUrl);
                } catch {
                    throw new Error("Tautan CV tidak valid.");
                }

                if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                    throw new Error("Tautan CV harus menggunakan HTTP atau HTTPS.");
                }
            }

            button.disabled = true;
            button.textContent = "Mengirim...";

            const { error } = await supabaseClient
                .from("applications")
                .insert({
                    job_id: jobId,
                    applicant_id: currentUser.id,
                    cover_letter: coverLetter,
                    cv_url: cvUrl
                });

            if (error) {
                if (error.code === "23505") {
                    throw new Error("Kamu sudah pernah melamar lowongan ini.");
                }

                throw error;
            }

            message.textContent = "Lamaran berhasil dikirim!";
            message.classList.add("success");
            form.reset();

            button.textContent = "Lamaran Terkirim";
            button.disabled = true;
        } catch (error) {
            console.error("Pengiriman lamaran gagal:", error);
            message.textContent = error.message || "Lamaran gagal dikirim.";
            message.classList.add("error");

            button.disabled = false;
            button.textContent = "Kirim Lamaran";
        }
    }

    // ==========================================
    // PENCARIAN DAN FILTER LOWONGAN
    // ==========================================
    const searchInput = $("searchInput");
    const locationFilter = $("locationFilter");
    const searchButton = $("searchButton");

    // Mendukung beberapa kemungkinan ID dropdown kategori.
    const categoryFilter =
        $("categoryFilter") ||
        $("categorySelect") ||
        $("categoryDropdown");

    function getJobsContainer() {
        return document.querySelector(".jobs-grid");
    }

    function renderJobs(jobs) {
        const container = getJobsContainer();

        if (!container) {
            console.warn("Elemen .jobs-grid tidak ditemukan di index.html.");
            return;
        }

        if (!jobs.length) {
            container.innerHTML = `
                <div class="jobs-empty">
                    <h3>Belum ada lowongan yang cocok</h3>
                    <p>Coba kata kunci atau lokasi lain, atau periksa kembali nanti.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = jobs.map((job) => {
            const company = job.companies || {};
            const companyName = company.company_name || "Perusahaan";
            const categoryName = job.categories?.name || "Umum";

            const logo = company.logo_url
                ? `<img src="${escapeHTML(company.logo_url)}"
                    alt="Logo ${escapeHTML(companyName)}"
                    loading="lazy"
                    onerror="this.style.display='none'">`
                : `<span>${escapeHTML(companyName.charAt(0).toUpperCase())}</span>`;

            const description = job.description || "";

            return `
                <article class="job-card" data-job-id="${job.id}">
                    <div class="job-card-header">
                        <div class="job-company-logo">${logo}</div>
                        <div class="job-company-info">
                            <h3>${escapeHTML(job.title)}</h3>
                            <p>${escapeHTML(companyName)}</p>
                        </div>
                    </div>

                    <div class="job-meta">
                        <span>📍 ${escapeHTML(job.location || company.location || "Lokasi fleksibel")}</span>
                        <span>💼 ${escapeHTML(job.job_type || "Tidak ditentukan")}</span>
                        <span>🏷️ ${escapeHTML(categoryName)}</span>
                        <span>🏢 ${escapeHTML(job.workplace_type || "On-site")}</span>
                    </div>

                    <p class="job-description">
                        ${escapeHTML(description.slice(0, 180))}
                        ${description.length > 180 ? "…" : ""}
                    </p>

                    <p class="job-salary">
                        ${escapeHTML(formatSalary(job.salary_min, job.salary_max))}
                    </p>

                    <div class="job-card-actions">
                        <button type="button" class="job-detail-btn"
                            data-action="detail" data-id="${job.id}">
                            Lihat Detail
                        </button>
                    </div>
                </article>
            `;
        }).join("");

        container.querySelectorAll('[data-action="detail"]').forEach((button) => {
            button.addEventListener("click", () => {
                const job = publicJobs.find(
                    (item) => String(item.id) === button.dataset.id
                );

                if (!job) return;

                openJobModal();
                renderJobDetail(job);
            });
        });
    }

    // Filter lokasi dan kategori diterapkan pada hasil dari database.
    function applyJobFilters() {
        const location = (locationFilter?.value || "").toLowerCase().trim();
        const selectedCategory =
            (categoryFilter?.value || "").toLowerCase().trim();

        const filteredJobs = publicJobs.filter((job) => {
            const jobLocation = (job.location || "").toLowerCase();
            const companyLocation =
                (job.companies?.location || "").toLowerCase();
            const categoryName =
                (job.categories?.name || "").toLowerCase();

            const locationMatch =
                !location ||
                location === "semua lokasi" ||
                location === "all" ||
                jobLocation.includes(location) ||
                companyLocation.includes(location);

            const categoryMatch =
                !selectedCategory ||
                selectedCategory === "semua kategori" ||
                selectedCategory === "all" ||
                categoryName === selectedCategory;

            return locationMatch && categoryMatch;
        });

        renderJobs(filteredJobs);
    }

    // Isi opsi kategori dari database. Kegagalan kategori tidak memblokir lowongan.
    async function loadCategoryOptions() {
        if (!categoryFilter) return;
        try {
            const { data, error } = await supabaseClient.from("categories").select("name").order("name", { ascending: true });
            if (error) throw error;
            const selected = categoryFilter.value;
            categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';
            (data || []).forEach((category) => {
                if (!category.name) return;
                const option = document.createElement("option");
                option.value = category.name.toLowerCase();
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
            categoryFilter.value = selected;
        } catch (error) {
            console.warn("Filter kategori tidak dapat dimuat:", error.message);
        }
    }

    // Memuat lowongan; gunakan pencarian biasa jika kolom search_vector belum tersedia.
    async function loadPublicJobs() {
        const container = getJobsContainer();

        if (!container) return;

        const keyword = (searchInput?.value || "").trim();

        container.innerHTML = `
            <div class="jobs-loading">
                ${keyword
                    ? "Mencari lowongan di database..."
                    : "Memuat lowongan dari database..."}
            </div>
        `;

        try {
            let query = supabaseClient
                .from("jobs")
                .select(`
                    id,
                    title,
                    description,
                    location,
                    job_type,
                    workplace_type,
                    salary_min,
                    salary_max,
                    requirements,
                    responsibilities,
                    created_at,
                    companies (
                        company_name,
                        location,
                        logo_url
                    ),
                    categories (
                        name
                    )
                `)
                .eq("is_active", true)
                .order("created_at", { ascending: false });

            // Kata kunci diproses PostgreSQL menggunakan search_vector.
            if (keyword) {
                query = query.textSearch(
                    "search_vector",
                    keyword,
                    {
                        type: "plain",
                        config: "simple"
                    }
                );
            }

            let { data, error } = await query;

            if (error && keyword && /search_vector|column.*does not exist|42703/i.test(
                [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ")
            )) {
                const pattern = keyword.replace(/[,%()]/g, " ").trim();
                if (pattern) {
                    const fallback = await supabaseClient.from("jobs")
                        .select(`id, title, description, location, job_type, workplace_type,
                            salary_min, salary_max, requirements, responsibilities, created_at,
                            companies (company_name, location, logo_url), categories (name)`)
                        .eq("is_active", true)
                        .or(`title.ilike.%${pattern}%,description.ilike.%${pattern}%,location.ilike.%${pattern}%`)
                        .order("created_at", { ascending: false });
                    data = fallback.data;
                    error = fallback.error;
                }
            }

            if (error) throw error;
            publicJobs = data || [];
            applyJobFilters();
        } catch (error) {
            console.error("Gagal memuat lowongan:", error);

            container.innerHTML = `
                <div class="jobs-empty">
                    <h3>Lowongan gagal dimuat</h3>
                    <p class="jobs-error-message"></p>
                    <button type="button" id="retryJobsBtn">
                        Coba Lagi
                    </button>
                </div>
            `;

            const errorMessage =
                container.querySelector(".jobs-error-message");

            if (errorMessage) {
                errorMessage.textContent = error.message;
            }

            $("retryJobsBtn")?.addEventListener("click", loadPublicJobs);
        }
    }

    // Tombol cari dan Enter menjalankan pencarian database.
    searchButton?.addEventListener("click", loadPublicJobs);

    searchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            loadPublicJobs();
        }
    });

    // Mengubah filter tanpa perlu melakukan query baru.
    locationFilter?.addEventListener("change", applyJobFilters);
    categoryFilter?.addEventListener("change", applyJobFilters);

    // ==========================================
    // BOOKMARK SEMENTARA
    // ==========================================
    document.querySelectorAll(".bookmark-btn").forEach((button) => {
        button.addEventListener("click", () => {
            button.classList.toggle("active");

            const saved = button.classList.contains("active");

            button.setAttribute("aria-pressed", String(saved));
            button.title = saved ? "Hapus dari tersimpan" : "Simpan lowongan";
        });
    });

    // ==========================================
    // TOMBOL POST JOB
    // ==========================================
    $("postJobBtn")?.addEventListener("click", async () => {
        try {
            await refreshCurrentUser();

            if (!currentUser) {
                openAuthModal("login");
                showMessage(
                    "loginMessage",
                    "Login dengan akun Recruiter untuk mengelola lowongan."
                );
                return;
            }

            if (currentProfile?.role !== "recruiter") {
                alert("Fitur ini hanya untuk akun Recruiter.");
                return;
            }

            window.location.href = "dashboard.html#jobsSection";
        } catch (error) {
            alert("Profil gagal dibaca: " + error.message);
        }
    });

    // ==========================================
    // INISIALISASI
    // ==========================================
    async function initializeApp() {
        try {
            const { data, error } = await supabaseClient.auth.getSession();

            if (error) throw error;

            await updateNavbar(data.session);
        } catch (error) {
            console.error("Gagal memeriksa sesi:", error);
        }
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
            updateNavbar(null);
        }
    });

    createJobModal();
    initializeApp();
    loadCategoryOptions();
    loadPublicJobs();
});
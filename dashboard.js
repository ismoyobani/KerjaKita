
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const menu = $("dashboardMenu");
    const message = $("dashboardMessage");

    let currentUser = null;
    let currentProfile = null;
    let company = null;
    let categories = [];
    let editingJobId = null;

    const APPLICATION_STATUSES = [
        { value: "pending", label: "Menunggu" },
        { value: "reviewed", label: "Sedang Ditinjau" },
        { value: "accepted", label: "Diterima" },
        { value: "rejected", label: "Ditolak" }
    ];

    function notify(text, type = "error") {
        message.textContent = text;
        message.className = `message ${type}`;
        message.hidden = false;
        message.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function escapeHTML(value = "") {
        return String(value).replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function formatDate(value) {
        if (!value) return "-";

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";

        return date.toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    }

    function statusLabel(status) {
        return APPLICATION_STATUSES.find(item => item.value === status)?.label
            || status
            || "Belum ditentukan";
    }

    function safeHttpUrl(value) {
        if (!value) return null;

        try {
            const url = new URL(value);
            return ["http:", "https:"].includes(url.protocol)
                ? url.href
                : null;
        } catch {
            return null;
        }
    }

    function addCard(icon, title, description, url) {
        const link = document.createElement("a");
        link.className = "menu-card";
        link.href = url;

        const iconEl = document.createElement("div");
        iconEl.className = "menu-icon";
        iconEl.textContent = icon;

        const titleEl = document.createElement("h3");
        titleEl.textContent = title;

        const descEl = document.createElement("p");
        descEl.textContent = description;

        const action = document.createElement("span");
        action.className = "menu-action";
        action.textContent = "Buka menu →";

        link.append(iconEl, titleEl, descEl, action);
        return link;
    }

    function renderMenu(role) {
        menu.replaceChildren();

        const items = role === "recruiter"
            ? [
                ["🏢", "Profil Perusahaan", "Kelola identitas perusahaan.", "#companySection"],
                ["💼", "Kelola Lowongan", "Tambah dan kelola lowongan.", "#jobsSection"],
                ["👥", "Daftar Pelamar", "Lihat dan proses lamaran masuk.", "#applicantsSection"],
                ["👤", "Profil Akun", "Informasi akun recruiter.", "#profileName"]
            ]
            : [
                ["🔎", "Cari Lowongan", "Temukan pekerjaan yang sesuai.", "index.html#jobList"],
                ["📄", "Lamaran Saya", "Pantau riwayat dan status lamaran.", "#applicationsSection"],
                ["🔖", "Lowongan Tersimpan", "Fitur bookmark akan dikembangkan berikutnya.", "#bookmarksSection"],
                ["👤", "Profil Saya", "Informasi akun pencari kerja.", "#profileName"]
            ];

        items.forEach(item => menu.appendChild(addCard(...item)));
    }

    function createRecruiterSections() {
        const anchor = menu.closest("section");
        if (!anchor) throw new Error("Bagian menu dashboard tidak ditemukan.");

        anchor.insertAdjacentHTML("afterend", `
            <section id="companySection" class="dashboard-section">
                <h2 class="section-title">Profil Perusahaan</h2>
                <form id="companyForm" class="dashboard-form">
                    <label for="companyName">Nama perusahaan *</label>
                    <input id="companyName" required maxlength="150"
                        placeholder="Contoh: PT Digital Nusantara">

                    <label for="companyLocation">Lokasi *</label>
                    <input id="companyLocation" required maxlength="150"
                        placeholder="Contoh: Surakarta, Jawa Tengah">

                    <label for="companyWebsite">Website</label>
                    <input id="companyWebsite" type="url" maxlength="500"
                        placeholder="https://contoh.com">

                    <label for="companyLogo">URL logo perusahaan</label>
                    <input id="companyLogo" type="url" maxlength="1000"
                        placeholder="https://...">

                    <label for="companyDescription">Deskripsi perusahaan</label>
                    <textarea id="companyDescription" rows="4"
                        placeholder="Jelaskan profil perusahaan..."></textarea>

                    <button class="btn btn-primary" type="submit">
                        Simpan Profil Perusahaan
                    </button>
                </form>
            </section>

            <section id="jobsSection" class="dashboard-section">
                <h2 class="section-title">Kelola Lowongan</h2>
                <p id="companyNotice" class="section-note">
                    Simpan profil perusahaan terlebih dahulu.
                </p>

                <form id="jobForm" class="dashboard-form">
                    <h3 id="jobFormTitle">Tambah Lowongan Baru</h3>

                    <label for="jobTitle">Judul pekerjaan *</label>
                    <input id="jobTitle" required maxlength="200"
                        placeholder="Contoh: Frontend Developer">

                    <label for="jobCategory">Kategori</label>
                    <select id="jobCategory">
                        <option value="">Pilih kategori</option>
                    </select>

                    <label for="jobLocation">Lokasi pekerjaan *</label>
                    <input id="jobLocation" required maxlength="200"
                        placeholder="Contoh: Surakarta">

                    <label for="jobType">Jenis pekerjaan *</label>
                    <select id="jobType" required>
                        <option value="Full Time">Full Time</option>
                        <option value="Part Time">Part Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Internship">Internship</option>
                        <option value="Freelance">Freelance</option>
                    </select>

                    <label for="workplaceType">Sistem kerja *</label>
                    <select id="workplaceType" required>
                        <option value="On-site">On-site</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="Remote">Remote</option>
                    </select>

                    <div class="form-row">
                        <div>
                            <label for="salaryMin">Gaji minimum (Rp)</label>
                            <input id="salaryMin" type="number" min="0" step="1"
                                placeholder="5000000">
                        </div>
                        <div>
                            <label for="salaryMax">Gaji maksimum (Rp)</label>
                            <input id="salaryMax" type="number" min="0" step="1"
                                placeholder="8000000">
                        </div>
                    </div>

                    <label for="jobExperience">Pengalaman</label>
                    <input id="jobExperience" maxlength="150"
                        placeholder="Contoh: Fresh graduate">

                    <label for="jobSkills">Keahlian (pisahkan dengan koma)</label>
                    <input id="jobSkills" placeholder="HTML, CSS, JavaScript">

                    <label for="jobDescription">Deskripsi pekerjaan *</label>
                    <textarea id="jobDescription" required rows="5"
                        placeholder="Jelaskan pekerjaan dan tugasnya..."></textarea>

                    <label for="jobRequirements">Persyaratan</label>
                    <textarea id="jobRequirements" rows="4"
                        placeholder="Persyaratan kandidat..."></textarea>

                    <label for="jobResponsibilities">Tanggung jawab</label>
                    <textarea id="jobResponsibilities" rows="4"
                        placeholder="Tanggung jawab pekerjaan..."></textarea>

                    <label class="checkbox-line">
                        <input id="jobActive" type="checkbox" checked>
                        Publikasikan lowongan
                    </label>

                    <div class="form-actions">
                        <button id="saveJobBtn" class="btn btn-primary" type="submit">
                            Simpan Lowongan
                        </button>
                        <button id="cancelEditBtn" class="btn btn-outline"
                            type="button" hidden>
                            Batal Edit
                        </button>
                    </div>
                </form>

                <h3 class="list-heading">Daftar Lowongan Saya</h3>
                <div id="jobsList" class="jobs-list">Memuat lowongan...</div>
            </section>

            <section id="applicantsSection" class="dashboard-section">
                <h2 class="section-title">Daftar Pelamar</h2>
                <p class="section-note">
                    Lamaran yang masuk ke lowongan milik perusahaan Anda.
                </p>
                <div id="applicantsList" class="jobs-list">Memuat lamaran...</div>
            </section>
        `);

        $("companyForm").addEventListener("submit", saveCompany);
        $("jobForm").addEventListener("submit", saveJob);
        $("cancelEditBtn").addEventListener("click", resetJobForm);
    }

    function createJobSeekerSections() {
        const anchor = menu.closest("section");
        if (!anchor) throw new Error("Bagian menu dashboard tidak ditemukan.");

        anchor.insertAdjacentHTML("afterend", `
            <section id="applicationsSection" class="dashboard-section">
                <h2 class="section-title">Lamaran Saya</h2>
                <p class="section-note">
                    Pantau pekerjaan yang sudah Anda lamar dan statusnya.
                </p>
                <div id="myApplicationsList" class="jobs-list">
                    Memuat riwayat lamaran...
                </div>
            </section>

            <section id="bookmarksSection" class="dashboard-section">
                <h2 class="section-title">Lowongan Tersimpan</h2>
                <p class="section-note">
                    Fitur bookmark akan diaktifkan pada tahap berikutnya.
                </p>
            </section>
        `);
    }

    async function loadCompany() {
        const { data, error } = await supabaseClient
            .from("companies")
            .select("*")
            .eq("recruiter_id", currentUser.id)
            .order("id", { ascending: true })
            .limit(1);

        if (error) throw error;

        company = data?.[0] || null;

        $("companyName").value = company?.company_name || "";
        $("companyLocation").value = company?.location || "";
        $("companyWebsite").value = company?.website || "";
        $("companyLogo").value = company?.logo_url || "";
        $("companyDescription").value = company?.description || "";

        $("companyNotice").textContent = company
            ? `Perusahaan aktif: ${company.company_name}`
            : "Simpan profil perusahaan terlebih dahulu sebelum menambah lowongan.";
    }

    async function saveCompany(event) {
        event.preventDefault();

        const button = $("companyForm").querySelector('[type="submit"]');
        button.disabled = true;

        try {
            const payload = {
                recruiter_id: currentUser.id,
                company_name: $("companyName").value.trim(),
                location: $("companyLocation").value.trim(),
                website: $("companyWebsite").value.trim() || null,
                logo_url: $("companyLogo").value.trim() || null,
                description: $("companyDescription").value.trim() || null,
                updated_at: new Date().toISOString()
            };

            if (!payload.company_name || !payload.location) {
                throw new Error("Nama perusahaan dan lokasi wajib diisi.");
            }

            const result = company
                ? await supabaseClient
                    .from("companies")
                    .update(payload)
                    .eq("id", company.id)
                    .eq("recruiter_id", currentUser.id)
                    .select()
                    .single()
                : await supabaseClient
                    .from("companies")
                    .insert(payload)
                    .select()
                    .single();

            if (result.error) throw result.error;

            company = result.data;
            await loadCompany();
            await loadJobs();
            await loadApplicants();

            notify("Profil perusahaan berhasil disimpan.", "success");
        } catch (error) {
            console.error(error);
            notify("Gagal menyimpan perusahaan: " + error.message);
        } finally {
            button.disabled = false;
        }
    }

    async function loadCategories() {
        const { data, error } = await supabaseClient
            .from("categories")
            .select("id, name")
            .order("name");

        if (error) throw error;

        categories = data || [];

        $("jobCategory").replaceChildren(new Option("Pilih kategori", ""));

        categories.forEach(category => {
            $("jobCategory").add(
                new Option(category.name, String(category.id))
            );
        });
    }

    function readOptionalNumber(id) {
        const value = $(id).value.trim();
        if (!value) return null;

        const number = Number(value);

        if (!Number.isSafeInteger(number) || number < 0) {
            throw new Error("Nilai gaji harus berupa bilangan bulat nonnegatif.");
        }

        return number;
    }

    async function saveJob(event) {
        event.preventDefault();

        if (!company) {
            notify("Simpan profil perusahaan terlebih dahulu.");
            $("companySection").scrollIntoView({ behavior: "smooth" });
            return;
        }

        const button = $("saveJobBtn");
        const wasEditing = editingJobId !== null;
        button.disabled = true;

        try {
            const salaryMin = readOptionalNumber("salaryMin");
            const salaryMax = readOptionalNumber("salaryMax");

            if (salaryMin !== null && salaryMax !== null &&
                salaryMax < salaryMin) {
                throw new Error("Gaji maksimum tidak boleh lebih kecil dari minimum.");
            }

            const categoryValue = $("jobCategory").value;

            const payload = {
                company_id: company.id,
                category_id: categoryValue ? Number(categoryValue) : null,
                title: $("jobTitle").value.trim(),
                location: $("jobLocation").value.trim(),
                job_type: $("jobType").value,
                workplace_type: $("workplaceType").value,
                salary_min: salaryMin,
                salary_max: salaryMax,
                experience: $("jobExperience").value.trim() || null,
                skills: $("jobSkills").value
                    .split(",")
                    .map(value => value.trim())
                    .filter(Boolean),
                description: $("jobDescription").value.trim(),
                requirements: $("jobRequirements").value.trim() || null,
                responsibilities: $("jobResponsibilities").value.trim() || null,
                is_active: $("jobActive").checked,
                updated_at: new Date().toISOString()
            };

            if (!payload.title || !payload.location || !payload.description) {
                throw new Error("Judul, lokasi, dan deskripsi wajib diisi.");
            }

            const result = wasEditing
                ? await supabaseClient
                    .from("jobs")
                    .update(payload)
                    .eq("id", editingJobId)
                    .eq("company_id", company.id)
                    .select()
                    .single()
                : await supabaseClient
                    .from("jobs")
                    .insert(payload)
                    .select()
                    .single();

            if (result.error) throw result.error;

            resetJobForm();
            await loadJobs();
            await loadApplicants();

            notify(
                wasEditing
                    ? "Lowongan berhasil diperbarui."
                    : "Lowongan berhasil ditambahkan.",
                "success"
            );
        } catch (error) {
            console.error(error);
            notify("Gagal menyimpan lowongan: " + error.message);
        } finally {
            button.disabled = false;
        }
    }

    async function loadJobs() {
        const list = $("jobsList");

        if (!company) {
            list.textContent = "Simpan profil perusahaan untuk mulai menambah lowongan.";
            return;
        }

        list.textContent = "Memuat lowongan...";

        const { data, error } = await supabaseClient
            .from("jobs")
            .select("*, categories(name)")
            .eq("company_id", company.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            list.textContent = "Gagal memuat lowongan: " + error.message;
            return;
        }

        if (!data?.length) {
            list.textContent = "Belum ada lowongan. Tambahkan lowongan pertama Anda.";
            return;
        }

        list.innerHTML = data.map(job => `
            <article class="job-management-card">
                <div class="job-management-header">
                    <div>
                        <h3>${escapeHTML(job.title)}</h3>
                        <p>${escapeHTML(job.location)} ·
                            ${escapeHTML(job.job_type)} ·
                            ${escapeHTML(job.categories?.name || "Tanpa kategori")}
                        </p>
                    </div>
                    <span class="job-status ${job.is_active ? "active" : "inactive"}">
                        ${job.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                </div>
                <p class="job-description">
                    ${escapeHTML((job.description || "").slice(0, 220))}
                    ${(job.description || "").length > 220 ? "…" : ""}
                </p>
                <div class="job-management-actions">
                    <button type="button" class="btn btn-outline"
                        data-action="edit" data-id="${job.id}">Edit</button>
                    <button type="button" class="btn btn-outline"
                        data-action="toggle" data-id="${job.id}">
                        ${job.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button type="button" class="btn btn-danger"
                        data-action="delete" data-id="${job.id}">Hapus</button>
                </div>
            </article>
        `).join("");

        list.querySelectorAll("button[data-action]").forEach(button => {
            button.addEventListener("click", () => {
                const job = data.find(item => String(item.id) === button.dataset.id);
                if (!job) return;

                if (button.dataset.action === "edit") editJob(job);
                if (button.dataset.action === "toggle") toggleJob(job);
                if (button.dataset.action === "delete") deleteJob(job);
            });
        });
    }

    function editJob(job) {
        editingJobId = job.id;

        $("jobFormTitle").textContent = "Edit Lowongan";
        $("saveJobBtn").textContent = "Simpan Perubahan";
        $("cancelEditBtn").hidden = false;

        $("jobTitle").value = job.title || "";
        $("jobCategory").value = job.category_id ? String(job.category_id) : "";
        $("jobLocation").value = job.location || "";
        $("jobType").value = job.job_type || "Full Time";
        $("workplaceType").value = job.workplace_type || "On-site";
        $("salaryMin").value = job.salary_min ?? "";
        $("salaryMax").value = job.salary_max ?? "";
        $("jobExperience").value = job.experience || "";
        $("jobSkills").value = (job.skills || []).join(", ");
        $("jobDescription").value = job.description || "";
        $("jobRequirements").value = job.requirements || "";
        $("jobResponsibilities").value = job.responsibilities || "";
        $("jobActive").checked = job.is_active;

        $("jobsSection").scrollIntoView({ behavior: "smooth" });
    }

    function resetJobForm() {
        editingJobId = null;
        $("jobForm").reset();
        $("jobFormTitle").textContent = "Tambah Lowongan Baru";
        $("saveJobBtn").textContent = "Simpan Lowongan";
        $("cancelEditBtn").hidden = true;
        $("jobActive").checked = true;
    }

    async function toggleJob(job) {
        try {
            const { error } = await supabaseClient
                .from("jobs")
                .update({
                    is_active: !job.is_active,
                    updated_at: new Date().toISOString()
                })
                .eq("id", job.id)
                .eq("company_id", company.id);

            if (error) throw error;

            await loadJobs();
            notify("Status lowongan berhasil diperbarui.", "success");
        } catch (error) {
            console.error(error);
            notify("Gagal mengubah status: " + error.message);
        }
    }

    async function deleteJob(job) {
        if (!confirm(
            `Hapus lowongan "${job.title}"? Jika lowongan sudah memiliki lamaran, database mungkin menolak penghapusan.`
        )) return;

        try {
            const { error } = await supabaseClient
                .from("jobs")
                .delete()
                .eq("id", job.id)
                .eq("company_id", company.id);

            if (error) throw error;

            await loadJobs();
            await loadApplicants();
            notify("Lowongan berhasil dihapus.", "success");
        } catch (error) {
            console.error(error);
            notify("Gagal menghapus lowongan: " + error.message);
        }
    }

    // Mengambil profil pelamar secara terpisah agar tidak bergantung
    // pada nama constraint foreign key Supabase.
    async function loadProfilesByIds(ids) {
        const uniqueIds = [...new Set(ids.filter(Boolean))];
        if (!uniqueIds.length) return {};

        const { data, error } = await supabaseClient
            .from("profiles")
            .select("id, full_name, email")
            .in("id", uniqueIds);

        if (error) throw error;

        return Object.fromEntries((data || []).map(profile => [
            profile.id,
            profile
        ]));
    }

    async function loadApplicants() {
        const list = $("applicantsList");
        if (!list) return;

        if (!company) {
            list.textContent = "Buat profil perusahaan terlebih dahulu.";
            return;
        }

        list.textContent = "Memuat lamaran masuk...";

        try {
            const { data: jobs, error: jobsError } = await supabaseClient
                .from("jobs")
                .select("id, title")
                .eq("company_id", company.id);

            if (jobsError) throw jobsError;

            if (!jobs?.length) {
                list.textContent = "Belum ada lowongan atau lamaran masuk.";
                return;
            }

            const jobIds = jobs.map(job => job.id);
            const jobMap = Object.fromEntries(
                jobs.map(job => [String(job.id), job])
            );

            const { data: applications, error: appError } = await supabaseClient
                .from("applications")
                .select("id, job_id, applicant_id, cover_letter, cv_url, status, created_at, updated_at")
                .in("job_id", jobIds)
                .order("created_at", { ascending: false });

            if (appError) throw appError;

            if (!applications?.length) {
                list.textContent = "Belum ada pelamar untuk lowongan Anda.";
                return;
            }

            const profiles = await loadProfilesByIds(
                applications.map(app => app.applicant_id)
            );

            list.innerHTML = applications.map(app => {
                const applicant = profiles[app.applicant_id];
                const job = jobMap[String(app.job_id)];
                const cvUrl = safeHttpUrl(app.cv_url);
                const statusOptions = APPLICATION_STATUSES.map(item => `
                    <option value="${item.value}"
                        ${app.status === item.value ? "selected" : ""}>
                        ${item.label}
                    </option>
                `).join("");

                return `
                    <article class="job-management-card">
                        <div class="job-management-header">
                            <div>
                                <h3>${escapeHTML(applicant?.full_name || "Nama tidak tersedia")}</h3>
                                <p>${escapeHTML(applicant?.email || "Email tidak tersedia")}</p>
                            </div>
                            <span class="job-status ${app.status === "accepted" ? "active" : ""}">
                                ${escapeHTML(statusLabel(app.status))}
                            </span>
                        </div>

                        <p><strong>Lowongan:</strong>
                            ${escapeHTML(job?.title || "Lowongan tidak ditemukan")}
                        </p>
                        <p><strong>Tanggal melamar:</strong>
                            ${escapeHTML(formatDate(app.created_at))}
                        </p>

                        <div class="application-letter">
                            <strong>Surat lamaran:</strong>
                            <p>${escapeHTML(app.cover_letter || "Pelamar tidak menambahkan surat lamaran.")}</p>
                        </div>

                        <p>
                            <strong>CV:</strong>
                            ${cvUrl
                                ? `<a href="${escapeHTML(cvUrl)}" target="_blank" rel="noopener noreferrer">Buka CV pelamar ↗</a>`
                                : "Tidak ada tautan CV yang valid."}
                        </p>

                        <div class="form-row">
                            <div>
                                <label for="status-${app.id}">Status lamaran</label>
                                <select id="status-${app.id}" data-status-id="${app.id}">
                                    ${statusOptions}
                                </select>
                            </div>
                            <div class="form-actions">
                                <button class="btn btn-primary"
                                    type="button" data-update-status="${app.id}">
                                    Simpan Status
                                </button>
                            </div>
                        </div>
                    </article>
                `;
            }).join("");

            list.querySelectorAll("[data-update-status]").forEach(button => {
                button.addEventListener("click", () => {
                    const app = applications.find(
                        item => String(item.id) === button.dataset.updateStatus
                    );

                    if (app) updateApplicationStatus(app);
                });
            });
        } catch (error) {
            console.error("Gagal memuat pelamar:", error);
            list.textContent = "Gagal memuat pelamar: " + error.message;
        }
    }

    async function updateApplicationStatus(application) {
        const select = $(`status-${application.id}`);
        const button = document.querySelector(
            `[data-update-status="${application.id}"]`
        );

        if (!select || !button) return;

        const newStatus = select.value;
        const previousText = button.textContent;
        button.disabled = true;
        button.textContent = "Menyimpan...";

        try {
            const { data, error } = await supabaseClient
                .from("applications")
                .update({
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq("id", application.id)
                .select("id, status")
                .single();

            if (error) throw error;
            if (!data) throw new Error("Status tidak berhasil diperbarui.");

            notify("Status lamaran berhasil diperbarui.", "success");
            await loadApplicants();
        } catch (error) {
            console.error(error);
            notify(
                "Gagal memperbarui status. Periksa kebijakan RLS dan nilai status yang diizinkan database. Detail: " +
                error.message
            );
            button.disabled = false;
            button.textContent = previousText;
        }
    }

    async function loadMyApplications() {
        const list = $("myApplicationsList");
        if (!list) return;

        list.textContent = "Memuat riwayat lamaran...";

        try {
            const { data: applications, error: appError } = await supabaseClient
                .from("applications")
                .select("id, job_id, cover_letter, cv_url, status, created_at, updated_at")
                .eq("applicant_id", currentUser.id)
                .order("created_at", { ascending: false });

            if (appError) throw appError;

            if (!applications?.length) {
                list.textContent = "Anda belum mengirim lamaran. Cari lowongan di halaman utama.";
                return;
            }

            const jobIds = [...new Set(applications.map(app => app.job_id))];

            const { data: jobs, error: jobsError } = await supabaseClient
                .from("jobs")
                .select("id, title, location, job_type, company_id")
                .in("id", jobIds);

            if (jobsError) throw jobsError;

            const companyIds = [...new Set((jobs || [])
                .map(job => job.company_id)
                .filter(Boolean))];

            let companies = [];

            if (companyIds.length) {
                const { data, error } = await supabaseClient
                    .from("companies")
                    .select("id, company_name")
                    .in("id", companyIds);

                if (error) throw error;
                companies = data || [];
            }

            const jobMap = Object.fromEntries(
                (jobs || []).map(job => [String(job.id), job])
            );
            const companyMap = Object.fromEntries(
                companies.map(item => [String(item.id), item])
            );

            list.innerHTML = applications.map(app => {
                const job = jobMap[String(app.job_id)];
                const employer = job
                    ? companyMap[String(job.company_id)]
                    : null;

                return `
                    <article class="job-management-card">
                        <div class="job-management-header">
                            <div>
                                <h3>${escapeHTML(job?.title || "Lowongan tidak tersedia")}</h3>
                                <p>${escapeHTML(employer?.company_name || "Perusahaan tidak tersedia")}</p>
                            </div>
                            <span class="job-status ${app.status === "accepted" ? "active" : ""}">
                                ${escapeHTML(statusLabel(app.status))}
                            </span>
                        </div>

                        <p>${escapeHTML(job?.location || "-")}
                            ${job?.job_type ? " · " + escapeHTML(job.job_type) : ""}
                        </p>
                        <p><strong>Tanggal melamar:</strong>
                            ${escapeHTML(formatDate(app.created_at))}
                        </p>
                        <p><strong>Terakhir diperbarui:</strong>
                            ${escapeHTML(formatDate(app.updated_at))}
                        </p>
                    </article>
                `;
            }).join("");
        } catch (error) {
            console.error("Gagal memuat riwayat lamaran:", error);
            list.textContent = "Gagal memuat riwayat lamaran: " + error.message;
        }
    }

    async function loadDashboard() {
        try {
            const { data: sessionData, error: sessionError } =
                await supabaseClient.auth.getSession();

            if (sessionError) throw sessionError;

            currentUser = sessionData.session?.user;

            if (!currentUser) {
                window.location.replace("index.html");
                return;
            }

            const { data: profile, error: profileError } = await supabaseClient
                .from("profiles")
                .select("id, full_name, email, role")
                .eq("id", currentUser.id)
                .maybeSingle();

            if (profileError) throw profileError;

            if (!profile) {
                notify("Profil akun belum ditemukan.");
                return;
            }

            currentProfile = profile;

            if (!["job_seeker", "recruiter"].includes(profile.role)) {
                notify("Role akun tidak valid.");
                return;
            }

            const name = profile.full_name || currentUser.email || "Pengguna";
            const recruiter = profile.role === "recruiter";

            $("userName").textContent = name;
            $("profileName").textContent = name;
            $("profileEmail").textContent = profile.email || currentUser.email || "-";
            $("userInitial").textContent = name.trim().charAt(0).toUpperCase() || "K";
            $("profileRole").textContent = recruiter ? "Recruiter" : "Job Seeker";
            $("welcomeTitle").textContent = `Halo, ${name}!`;
            $("welcomeDescription").textContent = recruiter
                ? "Kelola perusahaan, lowongan, dan lamaran kandidat."
                : "Temukan peluang kerja dan pantau status lamaran Anda.";

            renderMenu(profile.role);

            if (recruiter) {
                createRecruiterSections();
                await loadCategories();
                await loadCompany();
                await loadJobs();
                await loadApplicants();
            } else {
                createJobSeekerSections();
                await loadMyApplications();
            }
        } catch (error) {
            console.error("Gagal memuat dashboard:", error);
            notify("Dashboard gagal dimuat: " + error.message);
        }
    }

    $("logoutBtn")?.addEventListener("click", async () => {
        const button = $("logoutBtn");
        button.disabled = true;

        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            window.location.replace("index.html");
        } catch (error) {
            notify("Logout gagal: " + error.message);
            button.disabled = false;
        }
    });

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            window.location.replace("index.html");
        }
    });

    loadDashboard();
});
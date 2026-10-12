"use strict";

/* =========================================================
   KERJAKITA - DASHBOARD.JS
   Dashboard pelamar dan perekrut
   ========================================================= */

const dashboardState = {
    user: null,
    profile: null,
    jobs: [],
    applications: []
};

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
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

    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function formatStatus(status) {
    const labels = {
        pending: "Menunggu",
        reviewed: "Sedang ditinjau",
        accepted: "Diterima",
        rejected: "Ditolak"
    };

    return labels[status] || status || "Belum ada status";
}

function showMessage(message, type = "info") {
    const element = $("#dashboardMessage");

    if (element) {
        element.textContent = message;
        element.dataset.type = type;
        element.hidden = false;
        return;
    }

    if (type === "error") {
        alert(message);
    } else {
        console.log(message);
    }
}

function clearMessage() {
    const element = $("#dashboardMessage");

    if (element) {
        element.textContent = "";
        element.hidden = true;
    }
}

function setText(selector, value) {
    const element = $(selector);

    if (element) {
        element.textContent = value ?? "";
    }
}

function setHTML(selector, value) {
    const element = $(selector);

    if (element) {
        element.innerHTML = value;
    }
}

function setVisible(selector, visible) {
    const element = $(selector);

    if (element) {
        element.hidden = !visible;
    }
}

/* =========================================================
   AUTENTIKASI DAN PROFIL
   ========================================================= */

async function getCurrentProfile(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) throw error;

    return data;
}

async function initializeDashboard() {
    clearMessage();

    try {
        if (typeof supabase === "undefined") {
            throw new Error(
                "Supabase belum tersedia. Periksa urutan pemuatan supabase.js dan dashboard.js."
            );
        }

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
            window.location.href = "index.html";
            return;
        }

        dashboardState.user = user;

        const profile = await getCurrentProfile(user.id);

        if (!profile) {
            showMessage(
                "Profil pengguna belum ditemukan. Periksa data pada tabel profiles.",
                "error"
            );
            return;
        }

        dashboardState.profile = profile;

        renderUserProfile(profile, user);

        const role = String(profile.role || "").toLowerCase();

        if (role === "recruiter") {
            await loadRecruiterDashboard(user.id);
        } else if (role === "job_seeker") {
            await loadApplicantDashboard(user.id);
        } else {
            showMessage(
                "Peran akun tidak dikenali. Periksa nilai role pada tabel profiles.",
                "error"
            );
        }
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);

        showMessage(
            "Dashboard gagal dimuat: " +
                (error.message || "Terjadi kesalahan."),
            "error"
        );
    }
}

function renderUserProfile(profile, user) {
    const name =
        profile.full_name ||
        profile.name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "Pengguna";

    setText("#userName", name);
    setText("#welcomeTitle", `Selamat datang, ${name}!`);
    setText(
        "#welcomeDescription",
        profile.role === "recruiter"
            ? "Kelola lowongan dan pantau pelamar Anda."
            : "Pantau lamaran kerja dan temukan peluang baru."
    );

    setText("#profileName", name);
    setText("#profileEmail", user.email || "-");
    setText(
        "#profileRole",
        profile.role === "recruiter" ? "Perekrut" : "Pencari Kerja"
    );
    setText("#userInitial", name.trim().charAt(0).toUpperCase());
}

/* =========================================================
   DASHBOARD PENCARI KERJA
   ========================================================= */

async function loadApplicantDashboard(userId) {
    setText("#dashboardTitle", "Dashboard Pelamar");
    setText("#dashboardSubtitle", "Kelola lamaran pekerjaan Anda.");

    const { data, error } = await supabase
        .from("applications")
        .select(`
            id,
            job_id,
            applicant_id,
            cover_letter,
            cv_url,
            status,
            created_at,
            updated_at,
            jobs (
                id,
                title,
                location,
                employment_type,
                company_id,
                companies (
                    name
                )
            )
        `)
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Gagal memuat lamaran:", error);
        showMessage("Gagal memuat lamaran: " + error.message, "error");
        return;
    }

    dashboardState.applications = data || [];

    renderApplicantApplications(dashboardState.applications);
    renderApplicantStats(dashboardState.applications);
    renderDashboardMenu("job_seeker");
}

function renderApplicantStats(applications) {
    const total = applications.length;
    const pending = applications.filter(
        (item) => item.status === "pending"
    ).length;
    const accepted = applications.filter(
        (item) => item.status === "accepted"
    ).length;
    const rejected = applications.filter(
        (item) => item.status === "rejected"
    ).length;

    setText("#totalApplications", total);
    setText("#pendingApplications", pending);
    setText("#acceptedApplications", accepted);
    setText("#rejectedApplications", rejected);
}

function renderApplicantApplications(applications) {
    const container =
        $("#applicationsList") ||
        $("#applicationList") ||
        $("#dashboardContent");

    if (!container) return;

    if (!applications.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Belum ada lamaran</h3>
                <p>Lamaran pekerjaan yang Anda kirim akan muncul di sini.</p>
                <a href="index.html" class="btn btn-primary">
                    Cari Lowongan
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = applications.map((application) => {
        const job = application.jobs || {};
        const company = job.companies || {};

        return `
            <article class="application-card">
                <div class="application-card-header">
                    <div>
                        <h3>${escapeHTML(job.title || "Lowongan")}</h3>
                        <p>${escapeHTML(company.name || "Perusahaan")}</p>
                    </div>

                    <span class="status-badge status-${escapeHTML(
                        application.status || "pending"
                    )}">
                        ${escapeHTML(formatStatus(application.status))}
                    </span>
                </div>

                <div class="application-details">
                    <p>
                        <strong>Lokasi:</strong>
                        ${escapeHTML(job.location || "-")}
                    </p>

                    <p>
                        <strong>Tipe pekerjaan:</strong>
                        ${escapeHTML(job.employment_type || "-")}
                    </p>

                    <p>
                        <strong>Tanggal melamar:</strong>
                        ${escapeHTML(formatDate(application.created_at))}
                    </p>
                </div>

                ${
                    application.cover_letter
                        ? `<p class="cover-letter">
                            <strong>Surat lamaran:</strong>
                            ${escapeHTML(application.cover_letter)}
                           </p>`
                        : ""
                }

                ${
                    application.cv_url
                        ? `<p>
                            <a href="${escapeHTML(application.cv_url)}"
                               target="_blank"
                               rel="noopener noreferrer">
                                Lihat CV
                            </a>
                           </p>`
                        : ""
                }
            </article>
        `;
    }).join("");
}

/* =========================================================
   DASHBOARD PEREKRUT
   ========================================================= */

async function loadRecruiterDashboard(userId) {
    setText("#dashboardTitle", "Dashboard Perekrut");
    setText("#dashboardSubtitle", "Kelola lowongan dan lamaran kandidat.");

    const { data: companies, error: companyError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("recruiter_id", userId);

    if (companyError) {
        console.error("Gagal memuat perusahaan:", companyError);
        showMessage(
            "Gagal memuat perusahaan: " + companyError.message,
            "error"
        );
        return;
    }

    const companyIds = (companies || []).map((company) => company.id);

    if (!companyIds.length) {
        dashboardState.jobs = [];
        dashboardState.applications = [];

        renderRecruiterStats([], []);
        renderRecruiterApplications([]);
        renderDashboardMenu("recruiter");

        const container =
            $("#recruiterJobsList") ||
            $("#jobsList") ||
            $("#dashboardContent");

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Profil perusahaan belum tersedia</h3>
                    <p>
                        Buat atau hubungkan profil perusahaan dengan akun
                        perekrut agar Anda dapat mengelola lowongan.
                    </p>
                </div>
            `;
        }

        return;
    }

    const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select(`
            id,
            title,
            location,
            employment_type,
            is_active,
            created_at,
            company_id
        `)
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });

    if (jobsError) {
        console.error("Gagal memuat lowongan:", jobsError);
        showMessage("Gagal memuat lowongan: " + jobsError.message, "error");
        return;
    }

    dashboardState.jobs = jobs || [];

    const jobIds = dashboardState.jobs.map((job) => job.id);

    let applications = [];

    if (jobIds.length) {
        const { data, error } = await supabase
            .from("applications")
            .select(`
                id,
                job_id,
                applicant_id,
                cover_letter,
                cv_url,
                status,
                created_at,
                updated_at,
                jobs (
                    id,
                    title,
                    location,
                    company_id
                )
            `)
            .in("job_id", jobIds)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Gagal memuat pelamar:", error);
            showMessage(
                "Gagal memuat daftar pelamar. Periksa kebijakan SELECT RLS pada applications: " +
                    error.message,
                "error"
            );
            return;
        }

        applications = data || [];
    }

    dashboardState.applications = applications;

    renderRecruiterStats(dashboardState.jobs, applications);
    renderRecruiterJobs(dashboardState.jobs);
    renderRecruiterApplications(applications);
    renderDashboardMenu("recruiter");
}

function renderRecruiterStats(jobs, applications) {
    setText("#totalJobs", jobs.length);
    setText(
        "#activeJobs",
        jobs.filter((job) => job.is_active).length
    );
    setText("#totalApplicants", applications.length);
    setText(
        "#pendingApplications",
        applications.filter((item) => item.status === "pending").length
    );
}

function renderRecruiterJobs(jobs) {
    const container =
        $("#recruiterJobsList") ||
        $("#jobsList");

    if (!container) return;

    if (!jobs.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Belum ada lowongan</h3>
                <p>Lowongan yang Anda buat akan ditampilkan di sini.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="recruiter-jobs">
            ${jobs.map((job) => `
                <article class="job-card">
                    <div>
                        <h3>${escapeHTML(job.title)}</h3>
                        <p>${escapeHTML(job.location || "-")}</p>
                        <p>${escapeHTML(job.employment_type || "-")}</p>
                    </div>

                    <span class="status-badge ${
                        job.is_active ? "status-active" : "status-inactive"
                    }">
                        ${job.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                </article>
            `).join("")}
        </div>
    `;
}

function renderRecruiterApplications(applications) {
    const container =
        $("#recruiterApplicationsList") ||
        $("#applicantsList") ||
        $("#applicationsList") ||
        $("#applicationList");

    if (!container) return;

    if (!applications.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Belum ada pelamar</h3>
                <p>Lamaran untuk lowongan Anda akan muncul di sini.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = applications.map((application) => {
        const job = application.jobs || {};

        return `
            <article class="application-card">
                <div class="application-card-header">
                    <div>
                        <h3>${escapeHTML(job.title || "Lowongan")}</h3>
                        <p>Pelamar ID: ${escapeHTML(application.applicant_id)}</p>
                    </div>

                    <span class="status-badge status-${escapeHTML(
                        application.status || "pending"
                    )}">
                        ${escapeHTML(formatStatus(application.status))}
                    </span>
                </div>

                <div class="application-details">
                    <p>
                        <strong>Tanggal melamar:</strong>
                        ${escapeHTML(formatDate(application.created_at))}
                    </p>
                </div>

                ${
                    application.cover_letter
                        ? `<p>
                            <strong>Surat lamaran:</strong>
                            ${escapeHTML(application.cover_letter)}
                           </p>`
                        : ""
                }

                ${
                    application.cv_url
                        ? `<p>
                            <a href="${escapeHTML(application.cv_url)}"
                               target="_blank"
                               rel="noopener noreferrer">
                                Lihat CV
                            </a>
                           </p>`
                        : ""
                }

                <div class="application-actions">
                    <button
                        type="button"
                        class="btn btn-secondary"
                        data-application-id="${escapeHTML(application.id)}"
                        data-new-status="reviewed">
                        Tinjau
                    </button>

                    <button
                        type="button"
                        class="btn btn-success"
                        data-application-id="${escapeHTML(application.id)}"
                        data-new-status="accepted">
                        Terima
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger"
                        data-application-id="${escapeHTML(application.id)}"
                        data-new-status="rejected">
                        Tolak
                    </button>
                </div>
            </article>
        `;
    }).join("");

    container.querySelectorAll("[data-application-id]").forEach((button) => {
        button.addEventListener("click", async () => {
            const applicationId = button.dataset.applicationId;
            const newStatus = button.dataset.newStatus;

            const application = dashboardState.applications.find(
                (item) => String(item.id) === String(applicationId)
            );

            if (!application) {
                showMessage("Data lamaran tidak ditemukan.", "error");
                return;
            }

            const labels = {
                reviewed: "meninjau",
                accepted: "menerima",
                rejected: "menolak"
            };

            const confirmed = window.confirm(
                `Apakah Anda yakin ingin ${labels[newStatus]} lamaran ini?`
            );

            if (!confirmed) return;

            button.disabled = true;

            try {
                await updateApplicationStatus(application, newStatus);
            } finally {
                button.disabled = false;
            }
        });
    });
}

/* =========================================================
   UPDATE STATUS LAMARAN
   ========================================================= */

async function updateApplicationStatus(application, newStatus) {
    const allowedStatuses = [
        "pending",
        "reviewed",
        "accepted",
        "rejected"
    ];

    if (!application || application.id === undefined || application.id === null) {
        showMessage("ID lamaran tidak ditemukan.", "error");
        return;
    }

    if (!allowedStatuses.includes(newStatus)) {
        showMessage("Status lamaran tidak valid.", "error");
        return;
    }

    try {
        clearMessage();

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authData.user) {
            showMessage(
                "Sesi login berakhir. Silakan login kembali.",
                "error"
            );
            window.location.href = "index.html";
            return;
        }

        if (dashboardState.profile?.role !== "recruiter") {
            showMessage(
                "Hanya akun perekrut yang dapat mengubah status lamaran.",
                "error"
            );
            return;
        }

        const { data, error } = await supabase
            .from("applications")
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq("id", application.id)
            .select("id, status");

        if (error) {
            console.error("Update status gagal:", error);

            showMessage(
                "Gagal memperbarui status: " + error.message +
                ". Periksa kebijakan UPDATE dan SELECT RLS pada tabel applications.",
                "error"
            );
            return;
        }

        /*
         * UPDATE yang tidak mengembalikan baris dapat berarti:
         * - ID lamaran tidak cocok;
         * - akun bukan pemilik lowongan;
         * - kebijakan RLS tidak mengizinkan update.
         *
         * Jangan menganggap kondisi ini sebagai keberhasilan.
         */
        if (!data || data.length === 0) {
            showMessage(
                "Tidak ada baris yang diperbarui. Pastikan lamaran berasal dari lowongan milik perusahaan akun perekrut ini, dan periksa kebijakan RLS UPDATE serta SELECT.",
                "error"
            );
            return;
        }

        const updated = data[0];

        dashboardState.applications = dashboardState.applications.map(
            (item) => String(item.id) === String(updated.id)
                ? { ...item, status: updated.status }
                : item
        );

        showMessage(
            "Status lamaran berhasil diubah menjadi " +
                formatStatus(updated.status) + ".",
            "success"
        );

        await loadRecruiterDashboard(authData.user.id);
    } catch (error) {
        console.error("Kesalahan update status:", error);

        showMessage(
            "Terjadi kesalahan saat memperbarui status: " +
                (error.message || "Kesalahan tidak diketahui."),
            "error"
        );
    }
}

/* =========================================================
   MENU DASHBOARD
   ========================================================= */

function renderDashboardMenu(role) {
    const menu = $("#dashboardMenu");

    if (!menu) return;

    if (role === "recruiter") {
        menu.innerHTML = `
            <a href="#overview" data-dashboard-section="overview">
                Ringkasan
            </a>
            <a href="#jobs" data-dashboard-section="jobs">
                Lowongan Saya
            </a>
            <a href="#applications" data-dashboard-section="applications">
                Daftar Pelamar
            </a>
        `;
    } else {
        menu.innerHTML = `
            <a href="#overview" data-dashboard-section="overview">
                Ringkasan
            </a>
            <a href="#applications" data-dashboard-section="applications">
                Lamaran Saya
            </a>
            <a href="index.html">
                Cari Lowongan
            </a>
        `;
    }
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {
    const confirmed = window.confirm("Apakah Anda yakin ingin logout?");

    if (!confirmed) return;

    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout gagal:", error);

        showMessage(
            "Logout gagal: " + (error.message || "Kesalahan tidak diketahui."),
            "error"
        );
    }
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const logoutButton = $("#logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    initializeDashboard();
});

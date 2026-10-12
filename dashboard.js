"use strict";

async function initializeDashboard() {
    try {
        // 1. Pastikan pengguna sudah login
        const { data: auth, error: authError } =
            await supabaseClient.auth.getUser();

        if (authError) throw authError;

        if (!auth.user) {
            window.location.href = "index.html";
            return;
        }

        const user = auth.user;

        // 2. Ambil profil pengguna
        const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
            showDashboardError(
                "Profil belum ditemukan. Pastikan akun memiliki data pada tabel profiles."
            );
            return;
        }

        // 3. Tampilkan identitas pengguna
        const name =
            profile.full_name ||
            profile.name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Pengguna";

        setDashboardText("userName", name);
        setDashboardText("welcomeTitle", "Selamat datang, " + name + "!");
        setDashboardText("profileName", name);
        setDashboardText("profileEmail", user.email || "-");
        setDashboardText(
            "profileRole",
            profile.role === "recruiter" ? "Perekrut" : "Pencari Kerja"
        );
        setDashboardText("userInitial", name.charAt(0).toUpperCase());

        const role = String(profile.role || "").toLowerCase();

        if (role === "recruiter") {
            await loadRecruiterDashboard(user.id);
        } else if (role === "job_seeker") {
            await loadApplicantDashboard(user.id);
        } else {
            showDashboardError(
                "Role akun tidak dikenali: " + (profile.role || "kosong")
            );
        }
    } catch (error) {
        console.error("Dashboard error:", error);

        showDashboardError(
            "Dashboard gagal dimuat: " +
            (error.message || "Terjadi kesalahan.")
        );
    }
}

function setDashboardText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function showDashboardError(message) {
    console.error(message);

    const element = document.getElementById("dashboardMessage");

    if (element) {
        element.textContent = message;
        element.hidden = false;
    } else {
        alert(message);
    }
}

function escapeDashboardHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// DASHBOARD PENCARI KERJA
// ==========================================

async function loadApplicantDashboard(userId) {
    const { data, error } = await supabaseClient
        .from("applications")
        .select("*")
        .eq("applicant_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;

    const applications = data || [];

    setDashboardText("totalApplications", applications.length);
    setDashboardText(
        "pendingApplications",
        applications.filter(item => item.status === "pending").length
    );
    setDashboardText(
        "acceptedApplications",
        applications.filter(item => item.status === "accepted").length
    );
    setDashboardText(
        "rejectedApplications",
        applications.filter(item => item.status === "rejected").length
    );

    const container =
        document.getElementById("applicationsList") ||
        document.getElementById("applicationList");

    if (!container) return;

    if (applications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>Belum ada lamaran</h3>
                <p>Lamaran pekerjaan yang kamu kirim akan muncul di sini.</p>
                <a href="index.html">Cari Lowongan</a>
            </div>
        `;
        return;
    }

    container.innerHTML = applications.map(item => `
        <article class="application-card">
            <h3>Lamaran #${escapeDashboardHTML(item.id)}</h3>
            <p>Tanggal: ${escapeDashboardHTML(item.created_at || "-")}</p>
            <p>Status: <strong>${escapeDashboardHTML(item.status || "pending")}</strong></p>
            ${
                item.cover_letter
                    ? `<p>${escapeDashboardHTML(item.cover_letter)}</p>`
                    : ""
            }
            ${
                item.cv_url
                    ? `<a href="${escapeDashboardHTML(item.cv_url)}"
                         target="_blank" rel="noopener noreferrer">Lihat CV</a>`
                    : ""
            }
        </article>
    `).join("");
}

// ==========================================
// DASHBOARD PEREKRUT
// ==========================================

async function loadRecruiterDashboard(userId) {
    const { data: companies, error: companyError } = await supabaseClient
        .from("companies")
        .select("id, name")
        .eq("recruiter_id", userId);

    if (companyError) throw companyError;

    const companyIds = (companies || []).map(company => company.id);

    if (companyIds.length === 0) {
        setDashboardText("totalJobs", 0);
        setDashboardText("activeJobs", 0);
        setDashboardText("totalApplicants", 0);

        const container =
            document.getElementById("recruiterApplicationsList") ||
            document.getElementById("applicantsList") ||
            document.getElementById("applicationsList");

        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Belum ada perusahaan</h3>
                    <p>Hubungkan profil perusahaan dengan akun perekrut terlebih dahulu.</p>
                </div>
            `;
        }

        return;
    }

    const { data: jobs, error: jobsError } = await supabaseClient
        .from("jobs")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });

    if (jobsError) throw jobsError;

    const jobList = jobs || [];
    const jobIds = jobList.map(job => job.id);

    setDashboardText("totalJobs", jobList.length);
    setDashboardText(
        "activeJobs",
        jobList.filter(job => job.is_active === true).length
    );

    let applications = [];

    if (jobIds.length > 0) {
        const { data, error } = await supabaseClient
            .from("applications")
            .select("*")
            .in("job_id", jobIds)
            .order("created_at", { ascending: false });

        if (error) throw error;

        applications = data || [];
    }

    setDashboardText("totalApplicants", applications.length);
    setDashboardText(
        "pendingApplications",
        applications.filter(item => item.status === "pending").length
    );

    const jobsContainer =
        document.getElementById("recruiterJobsList") ||
        document.getElementById("jobsList");

    if (jobsContainer) {
        jobsContainer.innerHTML = jobList.length
            ? jobList.map(job => `
                <article class="job-card">
                    <h3>${escapeDashboardHTML(job.title || "Lowongan")}</h3>
                    <p>${escapeDashboardHTML(job.location || "-")}</p>
                    <p>Status: ${job.is_active ? "Aktif" : "Nonaktif"}</p>
                </article>
            `).join("")
            : "<p>Belum ada lowongan.</p>";
    }

    const applicationsContainer =
        document.getElementById("recruiterApplicationsList") ||
        document.getElementById("applicantsList") ||
        document.getElementById("applicationsList");

    if (!applicationsContainer) return;

    applicationsContainer.innerHTML = applications.length
        ? applications.map(item => `
            <article class="application-card">
                <h3>Lamaran #${escapeDashboardHTML(item.id)}</h3>
                <p>Lowongan ID: ${escapeDashboardHTML(item.job_id)}</p>
                <p>Pelamar ID: ${escapeDashboardHTML(item.applicant_id)}</p>
                <p>Status: <strong>${escapeDashboardHTML(item.status || "pending")}</strong></p>
                ${
                    item.cv_url
                        ? `<a href="${escapeDashboardHTML(item.cv_url)}"
                             target="_blank" rel="noopener noreferrer">Lihat CV</a>`
                        : ""
                }
                <div class="application-actions">
                    <button type="button"
                        data-app-id="${escapeDashboardHTML(item.id)}"
                        data-status="reviewed">Tinjau</button>
                    <button type="button"
                        data-app-id="${escapeDashboardHTML(item.id)}"
                        data-status="accepted">Terima</button>
                    <button type="button"
                        data-app-id="${escapeDashboardHTML(item.id)}"
                        data-status="rejected">Tolak</button>
                </div>
            </article>
        `).join("")
        : "<p>Belum ada pelamar.</p>";

    applicationsContainer.querySelectorAll("[data-app-id]").forEach(button => {
        button.addEventListener("click", async () => {
            const confirmed = confirm(
                "Ubah status lamaran menjadi " + button.dataset.status + "?"
            );

            if (!confirmed) return;

            button.disabled = true;

            try {
                await updateApplicationStatus(
                    button.dataset.appId,
                    button.dataset.status
                );
            } finally {
                button.disabled = false;
            }
        });
    });
}

// ==========================================
// PERBARUI STATUS LAMARAN
// ==========================================

async function updateApplicationStatus(applicationId, newStatus) {
    const allowedStatuses = ["pending", "reviewed", "accepted", "rejected"];

    if (!allowedStatuses.includes(newStatus)) {
        showDashboardError("Status lamaran tidak valid.");
        return;
    }

    const { data: auth, error: authError } = await supabaseClient.auth.getUser();

    if (authError) {
        showDashboardError(authError.message);
        return;
    }

    if (!auth.user) {
        window.location.href = "index.html";
        return;
    }

    const { data, error } = await supabaseClient
        .from("applications")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", applicationId)
        .select("id, status");

    if (error) {
        showDashboardError("Gagal mengubah status: " + error.message);
        return;
    }

    if (!data || data.length === 0) {
        showDashboardError(
            "Tidak ada data yang diperbarui. Pastikan akun perekrut memiliki hak UPDATE pada lamaran untuk lowongannya."
        );
        return;
    }

    alert("Status lamaran berhasil diubah menjadi " + newStatus + ".");
    await loadRecruiterDashboard(auth.user.id);
}

// ==========================================
// LOGOUT DAN INISIALISASI
// ==========================================

async function logout() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showDashboardError("Logout gagal: " + error.message);
        return;
    }

    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const logoutButton = document.getElementById("logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    initializeDashboard();
});

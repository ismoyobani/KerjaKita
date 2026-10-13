"use strict";

const $dash = (id) => document.getElementById(id);
let dashboardUser = null;
let dashboardProfile = null;
let recruiterCompanies = [];
let recruiterJobs = [];

function dashText(id, value) {
  const node = $dash(id);
  if (node) node.textContent = value == null ? "" : String(value);
}
function dashEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
}
function dashMessage(message, type = "error") {
  const node = $dash("dashboardMessage");
  if (!node) { alert(message); return; }
  node.hidden = false;
  node.className = "message " + (type === "success" ? "success" : "error");
  node.textContent = message;
}
function clearDashMessage() {
  const node = $dash("dashboardMessage");
  if (node) { node.hidden = true; node.textContent = ""; node.className = "message"; }
}
function formatDashDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("id-ID", {day:"numeric",month:"short",year:"numeric"});
}
function formatDashSalary(min, max) {
  const fmt = n => new Intl.NumberFormat("id-ID", {style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
  if (min != null && max != null) return fmt(min) + " – " + fmt(max);
  if (min != null) return "Mulai " + fmt(min);
  if (max != null) return "Hingga " + fmt(max);
  return "Gaji tidak dicantumkan";
}

async function initializeDashboard() {
  try {
    if (typeof supabaseClient === "undefined") throw new Error("Klien Supabase tidak tersedia. Periksa urutan script di dashboard.html.");
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) { window.location.replace("index.html"); return; }
    dashboardUser = authData.user;

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles").select("*").eq("id", dashboardUser.id).maybeSingle();
    if (profileError) throw profileError;
    dashboardProfile = profile || {
      id: dashboardUser.id,
      full_name: dashboardUser.user_metadata?.full_name || dashboardUser.email?.split("@")[0] || "Pengguna",
      role: dashboardUser.user_metadata?.role || ""
    };

    const name = dashboardProfile.full_name || dashboardProfile.name || dashboardUser.user_metadata?.full_name || dashboardUser.email?.split("@")[0] || "Pengguna";
    dashText("userName", name);
    dashText("welcomeTitle", "Selamat datang, " + name + "!");
    dashText("welcomeDescription", dashboardProfile.role === "recruiter"
      ? "Kelola perusahaan, publikasikan lowongan, dan tinjau pelamar."
      : "Pantau status lamaran dan temukan peluang karier berikutnya.");
    dashText("profileName", name);
    dashText("profileEmail", dashboardUser.email || dashboardProfile.email || "-");
    dashText("profileRole", dashboardProfile.role === "recruiter" ? "Perekrut" : "Pencari Kerja");
    dashText("userInitial", name.charAt(0).toUpperCase());

    if (dashboardProfile.role === "recruiter") {
      $dash("recruiterSection").hidden = false;
      await loadRecruiterDashboard();
      bindRecruiterForms();
    } else if (dashboardProfile.role === "job_seeker") {
      $dash("seekerSection").hidden = false;
      await loadApplicantDashboard();
    } else {
      throw new Error("Role profil tidak valid atau belum diisi. Role yang didukung: job_seeker atau recruiter.");
    }
  } catch (error) {
    console.error("Dashboard KerjaKita gagal dimuat:", error);
    dashMessage("Dashboard gagal dimuat: " + (error.message || "Terjadi kesalahan."));
  }
}

async function loadApplicantDashboard() {
  const { data, error } = await supabaseClient.from("applications")
    .select("*").eq("applicant_id", dashboardUser.id).order("created_at", {ascending:false});
  if (error) throw error;
  const applications = data || [];
  dashText("totalApplications", applications.length);
  dashText("pendingApplications", applications.filter(a => ["pending","reviewed"].includes(String(a.status).toLowerCase())).length);
  dashText("acceptedApplications", applications.filter(a => String(a.status).toLowerCase() === "accepted").length);
  dashText("rejectedApplications", applications.filter(a => String(a.status).toLowerCase() === "rejected").length);

  const list = $dash("applicationsList");
  if (!list) return;
  if (!applications.length) {
    list.innerHTML = '<article class="job-management-card"><h3>Belum ada lamaran</h3><p>Lamaran yang kamu kirim akan tampil di sini.</p><a href="index.html#lowongan">Cari lowongan</a></article>';
    return;
  }
  let jobsById = {};
  const jobIds = [...new Set(applications.map(a => a.job_id).filter(Boolean))];
  if (jobIds.length) {
    const {data: jobs, error: jobsError} = await supabaseClient.from("jobs").select("id,title,location,job_type,companies(company_name)").in("id", jobIds);
    if (!jobsError) (jobs || []).forEach(job => jobsById[String(job.id)] = job);
  }
  list.innerHTML = applications.map(app => {
    const job = jobsById[String(app.job_id)] || {};
    const company = job.companies || {};
    const status = String(app.status || "pending").toLowerCase();
    return '<article class="job-management-card"><div class="job-management-header"><div><h3>' +
      dashEscape(job.title || ("Lamaran #" + app.id)) + '</h3><p>' +
      dashEscape(company.company_name || "Perusahaan") + " · " + dashEscape(job.location || "Lokasi tidak dicantumkan") +
      '</p></div><span class="job-status ' + (status === "accepted" ? "active" : status === "rejected" ? "inactive" : "active") + '">' +
      dashEscape(statusLabel(status)) + '</span></div><p>Tanggal melamar: ' + dashEscape(formatDashDate(app.created_at)) +
      '</p>' + (app.cover_letter ? '<p class="job-description">' + dashEscape(app.cover_letter) + '</p>' : '') +
      (app.cv_url ? '<p><a href="' + dashEscape(app.cv_url) + '" target="_blank" rel="noopener noreferrer">Buka CV</a></p>' : '') +
      '</article>';
  }).join("");
}

function statusLabel(status) {
  return ({pending:"Menunggu",reviewed:"Sedang ditinjau",accepted:"Diterima",rejected:"Ditolak"})[status] || status;
}

async function loadRecruiterDashboard() {
  const {data: companies, error: companyError} = await supabaseClient
    .from("companies").select("*").eq("recruiter_id", dashboardUser.id);
  if (companyError) throw companyError;
  recruiterCompanies = companies || [];
  renderCompanies();

  const companyIds = recruiterCompanies.map(c => c.id);
  recruiterJobs = [];
  if (companyIds.length) {
    const {data: jobs, error: jobsError} = await supabaseClient.from("jobs")
      .select("*").in("company_id", companyIds).order("created_at", {ascending:false});
    if (jobsError) throw jobsError;
    recruiterJobs = jobs || [];
  }
  dashText("totalJobs", recruiterJobs.length);
  dashText("activeJobs", recruiterJobs.filter(j => j.is_active === true).length);
  const jobIds = recruiterJobs.map(j => j.id);
  let applications = [];
  if (jobIds.length) {
    const {data, error} = await supabaseClient.from("applications").select("*")
      .in("job_id", jobIds).order("created_at", {ascending:false});
    if (error) throw error;
    applications = data || [];
  }
  dashText("totalApplicants", applications.length);
  dashText("recruiterPendingApplications", applications.filter(a => ["pending","reviewed"].includes(String(a.status).toLowerCase())).length);
  renderRecruiterJobs();
  renderRecruiterApplications(applications);
  await loadCategories();
}

function renderCompanies() {
  const list = $dash("companiesList");
  const select = $dash("jobCompany");
  if (select) {
    select.innerHTML = '<option value="">Pilih perusahaan</option>' + recruiterCompanies.map(c =>
      '<option value="' + dashEscape(c.id) + '">' + dashEscape(c.company_name || c.name || "Perusahaan") + '</option>'
    ).join("");
  }
  if (!list) return;
  list.innerHTML = recruiterCompanies.length ? recruiterCompanies.map(c =>
    '<article class="job-management-card"><h3>' + dashEscape(c.company_name || c.name || "Perusahaan") +
    '</h3><p>' + dashEscape(c.location || "Lokasi belum diisi") + '</p>' +
    (c.logo_url ? '<p><a href="' + dashEscape(c.logo_url) + '" target="_blank" rel="noopener noreferrer">Lihat logo</a></p>' : '') +
    '</article>').join("") :
    '<article class="job-management-card"><p>Belum ada perusahaan. Tambahkan profil perusahaan sebelum membuat lowongan.</p></article>';
}

async function loadCategories() {
  const select = $dash("jobCategory");
  if (!select) return;
  try {
    const {data, error} = await supabaseClient.from("categories").select("id,name").order("name");
    if (error) throw error;
    select.innerHTML = '<option value="">Tanpa kategori</option>' + (data || []).map(c =>
      '<option value="' + dashEscape(c.id) + '">' + dashEscape(c.name) + '</option>'
    ).join("");
  } catch (error) {
    console.warn("Kategori tidak dapat dimuat:", error.message);
  }
}

function renderRecruiterJobs() {
  const list = $dash("recruiterJobsList");
  if (!list) return;
  if (!recruiterJobs.length) {
    list.innerHTML = '<article class="job-management-card"><h3>Belum ada lowongan</h3><p>Isi formulir di atas untuk mempublikasikan lowongan pertama.</p></article>';
    return;
  }
  list.innerHTML = recruiterJobs.map(job => {
    const company = recruiterCompanies.find(c => String(c.id) === String(job.company_id)) || {};
    return '<article class="job-management-card"><div class="job-management-header"><div><h3>' +
      dashEscape(job.title || "Lowongan") + '</h3><p>' + dashEscape(company.company_name || company.name || "Perusahaan") +
      ' · ' + dashEscape(job.location || "Lokasi fleksibel") + '</p></div><span class="job-status ' +
      (job.is_active ? "active" : "inactive") + '">' + (job.is_active ? "Aktif" : "Nonaktif") +
      '</span></div><p class="job-description">' + dashEscape(job.description || "") +
      '</p><p>' + dashEscape(job.job_type || "-") + ' · ' + dashEscape(job.workplace_type || "-") +
      ' · ' + dashEscape(formatDashSalary(job.salary_min, job.salary_max)) + '</p><div class="job-management-actions">' +
      '<button type="button" class="btn btn-outline" data-toggle-job="' + dashEscape(job.id) +
      '" data-active="' + String(!job.is_active) + '">' + (job.is_active ? "Nonaktifkan" : "Aktifkan") +
      '</button><button type="button" class="btn btn-danger" data-delete-job="' + dashEscape(job.id) + '">Hapus</button></div></article>';
  }).join("");
  list.querySelectorAll("[data-toggle-job]").forEach(button => button.addEventListener("click", async () => {
    const id = button.dataset.toggleJob;
    const active = button.dataset.active === "true";
    button.disabled = true;
    try {
      const {error} = await supabaseClient.from("jobs").update({is_active:active}).eq("id", id);
      if (error) throw error;
      dashMessage("Status lowongan diperbarui.", "success");
      await loadRecruiterDashboard();
    } catch (error) { dashMessage("Gagal memperbarui lowongan: " + error.message); }
    finally { button.disabled = false; }
  }));
  list.querySelectorAll("[data-delete-job]").forEach(button => button.addEventListener("click", async () => {
    if (!confirm("Hapus lowongan ini? Lamaran terkait mungkin membuat penghapusan ditolak oleh database.")) return;
    button.disabled = true;
    try {
      const {error} = await supabaseClient.from("jobs").delete().eq("id", button.dataset.deleteJob);
      if (error) throw error;
      dashMessage("Lowongan berhasil dihapus.", "success");
      await loadRecruiterDashboard();
    } catch (error) { dashMessage("Gagal menghapus lowongan: " + error.message); }
    finally { button.disabled = false; }
  }));
}

function renderRecruiterApplications(applications) {
  const list = $dash("recruiterApplicationsList");
  if (!list) return;
  if (!applications.length) {
    list.innerHTML = '<article class="job-management-card"><p>Belum ada lamaran masuk untuk lowonganmu.</p></article>';
    return;
  }
  const jobMap = Object.fromEntries(recruiterJobs.map(j => [String(j.id), j]));
  list.innerHTML = applications.map(app => {
    const job = jobMap[String(app.job_id)] || {};
    const status = String(app.status || "pending").toLowerCase();
    return '<article class="job-management-card"><div class="job-management-header"><div><h3>' +
      dashEscape(job.title || ("Lowongan #" + app.job_id)) + '</h3><p>Pelamar: ' +
      dashEscape(app.applicant_id || "Tidak tersedia") + ' · ' + dashEscape(formatDashDate(app.created_at)) +
      '</p></div><span class="job-status ' + (status === "rejected" ? "inactive" : "active") + '">' +
      dashEscape(statusLabel(status)) + '</span></div>' +
      (app.cover_letter ? '<p class="job-description">' + dashEscape(app.cover_letter) + '</p>' : '') +
      (app.cv_url ? '<p><a href="' + dashEscape(app.cv_url) + '" target="_blank" rel="noopener noreferrer">Buka CV</a></p>' : '') +
      '<div class="job-management-actions">' +
      '<button type="button" class="btn btn-outline" data-app-status="' + dashEscape(app.id) + '" data-status="reviewed">Tinjau</button>' +
      '<button type="button" class="btn btn-primary" data-app-status="' + dashEscape(app.id) + '" data-status="accepted">Terima</button>' +
      '<button type="button" class="btn btn-danger" data-app-status="' + dashEscape(app.id) + '" data-status="rejected">Tolak</button>' +
      '</div></article>';
  }).join("");
  list.querySelectorAll("[data-app-status]").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const {data, error} = await supabaseClient.from("applications")
        .update({status:button.dataset.status, updated_at:new Date().toISOString()})
        .eq("id", button.dataset.appStatus).select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("Database tidak mengizinkan perubahan. Periksa kebijakan RLS UPDATE pada tabel applications.");
      dashMessage("Status lamaran berhasil diubah menjadi " + statusLabel(button.dataset.status) + ".", "success");
      await loadRecruiterDashboard();
    } catch (error) { dashMessage("Gagal mengubah status lamaran: " + error.message); }
    finally { button.disabled = false; }
  }));
}

function bindRecruiterForms() {
  $dash("companyForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    clearDashMessage();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const companyName = $dash("companyName").value.trim();
      const location = $dash("companyLocation").value.trim() || null;
      const logoUrl = $dash("companyLogo").value.trim() || null;
      if (!companyName) throw new Error("Nama perusahaan wajib diisi.");
      const {error} = await supabaseClient.from("companies").insert({
        recruiter_id:dashboardUser.id, company_name:companyName, location, logo_url:logoUrl
      });
      if (error) throw error;
      form.reset();
      dashMessage("Profil perusahaan berhasil disimpan.", "success");
      await loadRecruiterDashboard();
    } catch (error) { dashMessage("Gagal menyimpan perusahaan: " + error.message); }
    finally { button.disabled = false; }
  });

  $dash("jobForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    clearDashMessage();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const companyId = $dash("jobCompany").value;
      const title = $dash("jobTitle").value.trim();
      const description = $dash("jobDescription").value.trim();
      const salaryMinRaw = $dash("salaryMin").value;
      const salaryMaxRaw = $dash("salaryMax").value;
      const salary_min = salaryMinRaw === "" ? null : Number(salaryMinRaw);
      const salary_max = salaryMaxRaw === "" ? null : Number(salaryMaxRaw);
      if (!companyId) throw new Error("Pilih perusahaan terlebih dahulu.");
      if (!title || !description) throw new Error("Jabatan dan deskripsi wajib diisi.");
      if (salary_min != null && salary_max != null && salary_max < salary_min) throw new Error("Gaji maksimum tidak boleh lebih kecil dari gaji minimum.");
      const job = {
        company_id:companyId, title, description,
        location:$dash("jobLocation").value.trim() || null,
        job_type:$dash("jobType").value,
        workplace_type:$dash("workplaceType").value,
        salary_min, salary_max,
        requirements:$dash("jobRequirements").value.trim() || null,
        responsibilities:$dash("jobResponsibilities").value.trim() || null,
        is_active:$dash("jobIsActive").checked
      };
      const categoryId = $dash("jobCategory").value;
      if (categoryId) job.category_id = categoryId;
      const {error} = await supabaseClient.from("jobs").insert(job);
      if (error) throw error;
      form.reset();
      $dash("jobIsActive").checked = true;
      dashMessage("Lowongan berhasil dipublikasikan.", "success");
      await loadRecruiterDashboard();
    } catch (error) { dashMessage("Gagal membuat lowongan: " + error.message); }
    finally { button.disabled = false; }
  });
}

async function logout() {
  try {
    const {error} = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.replace("index.html");
  } catch (error) { dashMessage("Logout gagal: " + error.message); }
}

document.addEventListener("DOMContentLoaded", () => {
  $dash("logoutBtn")?.addEventListener("click", logout);
  initializeDashboard();
});

"use strict";

/*
 * EduCore School Portal — starter edition
 *
 * Important:
 * This version stores information in the current browser using localStorage.
 * It is for learning and demonstration, not secure multi-school production use.
 */

const STORAGE_KEY = "educore-portal-data-v1";

const DEFAULT_DATA = {
  students: [],
  attendance: {},
  results: [],
  announcements: [],
  settings: {
    schoolName: "My School",
    schoolEmail: "",
    academicSession: "2026/2027",
    academicTerm: "First Term"
  },
  selectedPlan: "Trial"
};

let data = loadData();
let toastTimer;

const PAGE_TITLES = {
  dashboard: "Dashboard",
  students: "Students",
  teachers: "Teachers",
  academics: "Academics",
  attendance: "Attendance",
  exams: "Results & Exams",
  fees: "School Fees",
  communication: "Communication",
  subscriptions: "Subscription",
  settings: "Settings"
};

/* ---------------------------
   GENERAL HELPERS
---------------------------- */

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return structuredClone(DEFAULT_DATA);
    }

    const parsed = JSON.parse(saved);

    return {
      ...structuredClone(DEFAULT_DATA),
      ...parsed,
      students: Array.isArray(parsed.students) ? parsed.students : [],
      attendance:
        parsed.attendance && typeof parsed.attendance === "object"
          ? parsed.attendance
          : {},
      results: Array.isArray(parsed.results) ? parsed.results : [],
      announcements: Array.isArray(parsed.announcements)
        ? parsed.announcements
        : [],
      settings: {
        ...DEFAULT_DATA.settings,
        ...(parsed.settings || {})
      },
      selectedPlan: parsed.selectedPlan || "Trial"
    };
  } catch (error) {
    console.error("Could not load EduCore data:", error);
    return structuredClone(DEFAULT_DATA);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateDashboard();
    return true;
  } catch (error) {
    console.error("Could not save EduCore data:", error);
    showToast(
      "Unable to save data. Check browser storage or available space."
    );
    return false;
  }
}

function $(selector) {
  return document.querySelector(selector);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function showToast(message) {
  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(toastTimer);

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function makeId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function findStudent(studentId) {
  return data.students.find(student => student.id === studentId);
}

function gradeFor(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}

/* ---------------------------
   PAGE NAVIGATION
---------------------------- */

function showPage(pageName) {
  if (!PAGE_TITLES[pageName]) {
    pageName = "dashboard";
  }

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });

  document.querySelectorAll("#main-nav [data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageName);
  });

  const heading = $("#page-heading");
  const breadcrumb = $("#breadcrumb");

  if (heading) heading.textContent = PAGE_TITLES[pageName];
  if (breadcrumb) breadcrumb.textContent = "School administration";

  if (pageName === "attendance") renderAttendance();
  if (pageName === "exams") {
    renderStudentOptions();
    renderResults();
  }
  if (pageName === "students") renderStudents();
}

function setupNavigation() {
  const nav = $("#main-nav");

  if (nav) {
    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-page]");

      if (!button) return;

      showPage(button.dataset.page);
    });
  }

  document.addEventListener("click", event => {
    const goButton = event.target.closest("[data-go]");

    if (goButton) {
      showPage(goButton.dataset.go);
    }
  });
}

/* ---------------------------
   DASHBOARD
---------------------------- */

function updateDashboard() {
  const statStudents = $("#stat-students");
  const statAttendance = $("#stat-attendance");
  const statResults = $("#stat-results");
  const statAnnouncements = $("#stat-announcements");

  if (statStudents) {
    statStudents.textContent = data.students.length;
  }

  if (statAttendance) {
    statAttendance.textContent = Object.values(data.attendance).reduce(
      (total, dayRecords) =>
        total +
        (dayRecords && typeof dayRecords === "object"
          ? Object.keys(dayRecords).length
          : 0),
      0
    );
  }

  if (statResults) {
    statResults.textContent = data.results.length;
  }

  if (statAnnouncements) {
    statAnnouncements.textContent = data.announcements.length;
  }

  const recentStudents = $("#recent-students");

  if (recentStudents) {
    const latest = [...data.students].slice(-5).reverse();

    recentStudents.innerHTML = latest.length
      ? latest.map(student => `
          <tr>
            <td>${escapeHTML(student.name)}</td>
            <td>${escapeHTML(student.id)}</td>
            <td>${escapeHTML(student.className)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3" class="empty-state">
           No students added yet.
         </td></tr>`;
  }

  const countLabel = $("#student-count-label");

  if (countLabel) {
    countLabel.textContent =
      `${data.students.length} student${data.students.length === 1 ? "" : "s"}`;
  }

  const currentPlan = $("#current-plan");

  if (currentPlan) {
    currentPlan.textContent = data.selectedPlan;
  }

  const schoolName = $("#sidebar-school-name");

  if (schoolName) {
    schoolName.textContent = data.settings.schoolName || "My School";
  }
}

/* ---------------------------
   STUDENT MANAGEMENT
---------------------------- */

function renderStudents(searchTerm = "") {
  const tbody = $("#students-table");

  if (!tbody) return;

  const term = searchTerm.trim().toLowerCase();

  const students = data.students.filter(student => {
    const searchable = [
      student.id,
      student.name,
      student.className,
      student.parentEmail
    ].join(" ").toLowerCase();

    return searchable.includes(term);
  });

  tbody.innerHTML = students.length
    ? students.map(student => `
        <tr>
          <td>${escapeHTML(student.id)}</td>
          <td>${escapeHTML(student.name)}</td>
          <td>${escapeHTML(student.className)}</td>
          <td>${escapeHTML(student.parentEmail || "—")}</td>
          <td>
            <button
              class="action-link"
              type="button"
              data-delete-student="${escapeHTML(student.id)}"
            >Delete</button>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" class="empty-state">
         ${term ? "No matching students found." : "No students registered."}
       </td></tr>`;

  renderStudentOptions();
}

function toggleStudentForm(show) {
  const panel = $("#student-form-panel");

  if (!panel) return;

  panel.classList.toggle("hidden", !show);

  if (show) {
    $("#student-name")?.focus();
  }
}

function setupStudentManagement() {
  $("#toggle-student-form")?.addEventListener("click", () => {
    toggleStudentForm($("#student-form-panel")?.classList.contains("hidden"));
  });

  $("#cancel-student")?.addEventListener("click", () => {
    $("#student-form")?.reset();
    toggleStudentForm(false);
  });

  $("#student-search")?.addEventListener("input", event => {
    renderStudents(event.target.value);
  });

  $("#student-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#student-name").value.trim();
    const id = $("#student-id").value.trim();
    const className = $("#student-class").value.trim();
    const parentEmail = $("#parent-email").value.trim();

    if (!name || !id || !className) {
      showToast("Please complete the required student fields.");
      return;
    }

    const duplicate = data.students.some(
      student => student.id.toLowerCase() === id.toLowerCase()
    );

    if (duplicate) {
      showToast("That student ID is already registered.");
      return;
    }

    data.students.push({
      id,
      name,
      className,
      parentEmail,
      createdAt: new Date().toISOString()
    });

    if (!saveData()) return;

    $("#student-form").reset();
    toggleStudentForm(false);
    renderStudents($("#student-search")?.value || "");
    renderAttendance();
    renderStudentOptions();

    showToast("Student registered successfully.");
  });

  $("#students-table")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-student]");

    if (!button) return;

    const studentId = button.dataset.deleteStudent;
    const student = findStudent(studentId);

    if (!student) return;

    const confirmed = window.confirm(
      `Delete the record for ${student.name}? Related attendance and results will also be removed.`
    );

    if (!confirmed) return;

    data.students = data.students.filter(item => item.id !== studentId);

    Object.keys(data.attendance).forEach(date => {
      delete data.attendance[date][studentId];

      if (Object.keys(data.attendance[date]).length === 0) {
        delete data.attendance[date];
      }
    });

    data.results = data.results.filter(
      result => result.studentId !== studentId
    );

    if (!saveData()) return;

    renderStudents($("#student-search")?.value || "");
    renderAttendance();
    renderResults();

    showToast("Student and related records deleted.");
  });
}

/* ---------------------------
   ATTENDANCE
---------------------------- */

function getAttendanceStatus(date, studentId) {
  return data.attendance[date]?.[studentId] || "Present";
}

function renderAttendance() {
  const tbody = $("#attendance-table");

  if (!tbody) return;

  const dateInput = $("#attendance-date");
  const date = dateInput?.value || todayLocal();

  if (!data.students.length) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="empty-state">
        Add students before taking attendance.
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = data.students.map(student => {
    const status = getAttendanceStatus(date, student.id);

    return `
      <tr>
        <td>${escapeHTML(student.id)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.className)}</td>
        <td>
          <select
            class="status-select"
            data-attendance-student="${escapeHTML(student.id)}"
            aria-label="Attendance status for ${escapeHTML(student.name)}"
          >
            <option value="Present" ${status === "Present" ? "selected" : ""}>Present</option>
            <option value="Absent" ${status === "Absent" ? "selected" : ""}>Absent</option>
            <option value="Late" ${status === "Late" ? "selected" : ""}>Late</option>
            <option value="Excused" ${status === "Excused" ? "selected" : ""}>Excused</option>
          </select>
        </td>
      </tr>
    `;
  }).join("");
}

function setupAttendance() {
  const dateInput = $("#attendance-date");

  if (dateInput) {
    dateInput.value = todayLocal();
    dateInput.addEventListener("change", renderAttendance);
  }

  $("#attendance-table")?.addEventListener("change", event => {
    const select = event.target.closest("[data-attendance-student]");

    if (!select) return;

    const date = dateInput?.value || todayLocal();
    const studentId = select.dataset.attendanceStudent;

    if (!data.attendance[date]) {
      data.attendance[date] = {};
    }

    data.attendance[date][studentId] = select.value;
  });

  $("#save-attendance")?.addEventListener("click", () => {
    const date = dateInput?.value;

    if (!date) {
      showToast("Please select an attendance date.");
      return;
    }

    if (!data.students.length) {
      showToast("Register students before saving attendance.");
      return;
    }

    if (!data.attendance[date]) {
      data.attendance[date] = {};
    }

    document.querySelectorAll("[data-attendance-student]").forEach(select => {
      data.attendance[date][select.dataset.attendanceStudent] = select.value;
    });

    if (!saveData()) return;

    showToast(`Attendance saved for ${formatDate(date)}.`);
  });
}

/* ---------------------------
   RESULTS AND EXAMS
---------------------------- */

function renderStudentOptions() {
  const select = $("#result-student");

  if (!select) return;

  const previousValue = select.value;

  select.innerHTML = `
    <option value="">Select student</option>
    ${data.students.map(student => `
      <option value="${escapeHTML(student.id)}">
        ${escapeHTML(student.name)} (${escapeHTML(student.id)})
      </option>
    `).join("")}
  `;

  if (data.students.some(student => student.id === previousValue)) {
    select.value = previousValue;
  }
}

function renderResults() {
  const tbody = $("#results-table");

  if (!tbody) return;

  tbody.innerHTML = data.results.length
    ? [...data.results].reverse().map(result => {
        const student = findStudent(result.studentId);
        const studentName = student ? student.name : "Unknown student";

        return `
          <tr>
            <td>${escapeHTML(studentName)}</td>
            <td>${escapeHTML(result.subject)}</td>
            <td>${escapeHTML(result.score)}</td>
            <td><span class="pill">${gradeFor(Number(result.score))}</span></td>
            <td>
              <button
                class="action-link"
                type="button"
                data-delete-result="${escapeHTML(result.id)}"
              >Delete</button>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="5" class="empty-state">
         No results recorded yet.
       </td></tr>`;
}

function setupResults() {
  $("#result-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const studentId = $("#result-student").value;
    const subject = $("#result-subject").value.trim();
    const scoreValue = $("#result-score").value;
    const score = Number(scoreValue);

    if (!findStudent(studentId)) {
      showToast("Please select a registered student.");
      return;
    }

    if (!subject) {
      showToast("Please enter a subject.");
      return;
    }

    if (
      scoreValue === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      showToast("Enter a valid score from 0 to 100.");
      return;
    }

    data.results.push({
      id: makeId("result"),
      studentId,
      subject,
      score,
      createdAt: new Date().toISOString()
    });

    if (!saveData()) return;

    $("#result-form").reset();
    renderResults();
    showToast("Result saved successfully.");
  });

  $("#results-table")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-result]");

    if (!button) return;

    if (!window.confirm("Delete this result?")) return;

    data.results = data.results.filter(
      result => result.id !== button.dataset.deleteResult
    );

    if (!saveData()) return;

    renderResults();
    showToast("Result deleted.");
  });
}

/* ---------------------------
   ANNOUNCEMENTS
---------------------------- */

function renderAnnouncements() {
  const container = $("#announcement-list");

  if (!container) return;

  container.innerHTML = data.announcements.length
    ? [...data.announcements].reverse().map(item => `
        <article class="announcement-item">
          <p>${escapeHTML(item.message)}</p>
          <small>Posted ${escapeHTML(formatDate(item.date))}</small>
          <button
            type="button"
            data-delete-announcement="${escapeHTML(item.id)}"
          >Delete</button>
        </article>
      `).join("")
    : `<p class="empty-state">No announcements published yet.</p>`;
}

function setupAnnouncements() {
  $("#announcement-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const message = $("#announcement-message").value.trim();

    if (!message) {
      showToast("Please enter an announcement.");
      return;
    }

    data.announcements.push({
      id: makeId("announcement"),
      message,
      date: todayLocal()
    });

    if (!saveData()) return;

    $("#announcement-form").reset();
    renderAnnouncements();
    showToast("Announcement published.");
  });

  $("#announcement-list")?.addEventListener("click", event => {
    const button = event.target.closest("[data-delete-announcement]");

    if (!button) return;

    if (!window.confirm("Delete this announcement?")) return;

    data.announcements = data.announcements.filter(
      item => item.id !== button.dataset.deleteAnnouncement
    );

    if (!saveData()) return;

    renderAnnouncements();
    showToast("Announcement deleted.");
  });
}

/* ---------------------------
   SCHOOL SETTINGS
---------------------------- */

function populateSettings() {
  const settings = data.settings;

  if ($("#school-name")) {
    $("#school-name").value = settings.schoolName || "";
  }

  if ($("#school-email")) {
    $("#school-email").value = settings.schoolEmail || "";
  }

  if ($("#academic-session")) {
    $("#academic-session").value = settings.academicSession || "";
  }

  if ($("#academic-term")) {
    $("#academic-term").value = settings.academicTerm || "First Term";
  }

  const sidebarName = $("#sidebar-school-name");

  if (sidebarName) {
    sidebarName.textContent = settings.schoolName || "My School";
  }
}

function setupSettings() {
  $("#settings-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const schoolName = $("#school-name").value.trim();
    const schoolEmail = $("#school-email").value.trim();
    const academicSession = $("#academic-session").value.trim();
    const academicTerm = $("#academic-term").value;

    if (!schoolName) {
      showToast("Please enter your school name.");
      return;
    }

    data.settings = {
      schoolName,
      schoolEmail,
      academicSession,
      academicTerm
    };

    if (!saveData()) return;

    populateSettings();
    showToast("School settings saved.");
  });

  $("#clear-data")?.addEventListener("click", () => {
    const confirmed = window.confirm(
      "This will permanently clear EduCore demo records stored in this browser. Continue?"
    );

    if (!confirmed) return;

    try {
      localStorage.removeItem(STORAGE_KEY);
      data = structuredClone(DEFAULT_DATA);

      $("#student-form")?.reset();
      $("#result-form")?.reset();
      $("#announcement-form")?.reset();
      $("#student-search").value = "";

      populateSettings();
      renderStudents();
      renderAttendance();
      renderStudentOptions();
      renderResults();
      renderAnnouncements();
      updateDashboard();

      showToast("Demo data cleared.");
    } catch (error) {
      console.error("Could not clear EduCore data:", error);
      showToast("Unable to clear the data.");
    }
  });
}

/* ---------------------------
   SUBSCRIPTION DEMO
---------------------------- */

function setupSubscriptions() {
  document.querySelectorAll(".choose-plan").forEach(button => {
    button.addEventListener("click", () => {
      const plan = button.dataset.plan;

      const confirmed = window.confirm(
        `Select the ${plan} plan for this demo? No payment will be taken.`
      );

      if (!confirmed) return;

      data.selectedPlan = plan;

      if (!saveData()) return;

      showToast(
        `${plan} selected for the demo. No payment was processed.`
      );
    });
  });
}

/* ---------------------------
   NOTIFICATIONS AND STARTUP
---------------------------- */

function setupNotifications() {
  $("#notification-button")?.addEventListener("click", () => {
    const total = data.announcements.length;

    showToast(
      total
        ? `You have ${total} announcement${total === 1 ? "" : "s"} saved.`
        : "There are no announcements yet."
    );
  });
}

function initializePortal() {
  const year = $("#year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  setupNavigation();
  setupStudentManagement();
  setupAttendance();
  setupResults();
  setupAnnouncements();
  setupSettings();
  setupSubscriptions();
  setupNotifications();

  populateSettings();
  renderStudents();
  renderAttendance();
  renderStudentOptions();
  renderResults();
  renderAnnouncements();
  updateDashboard();
  showPage("dashboard");
}

document.addEventListener("DOMContentLoaded", initializePortal);

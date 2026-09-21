const CAPABILITIES = [
  { name: "Active Listening", layer: "Perception", score: 3.4, baseline: 2.7 },
  { name: "Adaptive Thinking", layer: "Cognition", score: 3.7, baseline: 3.0 },
  { name: "Judgement & Restraint", layer: "Cognition", score: 2.8, baseline: 2.5 },
  { name: "Constructive Hypothesis Building", layer: "Cognition", score: 3.1, baseline: 2.6 },
  { name: "Professional Speech Excellence", layer: "Expression", score: 3.6, baseline: 3.0 },
  { name: "Language Accuracy", layer: "Expression", score: 3.9, baseline: 3.3 }
];
const SCENARIOS = [
  { id: "insufficient-evidence", title: "Alex — VP Operations", type: "ADVISOR-LED", domain: "FARM / MINE", context: "A delivered analytics solution is technically successful, but adoption remains low. Initiate a consultative conversation with Alex.", caps: ["Constructive Hypothesis Building", "Professional Speech Excellence", "Language Accuracy"], impactEmphasis: ["Interpret the Context", "Position Your POV", "Make Outcomes Visible", "Adapt Communication"], difficulty: "Developing", status: "Assigned" },
  { id: "brian-cto", title: "Brian — CTO", type: "CLIENT-TRIGGERED", domain: "FARM", context: "Brian has challenged the value of the current solution and needs a credible basis for deciding whether to continue.", clientStatement: "We have spent six months on this solution and still do not see the business impact. Why should I approve the next phase?", caps: ["Active Listening", "Adaptive Thinking", "Judgement & Restraint", "Professional Speech Excellence", "Language Accuracy"], impactEmphasis: ["Interpret the Context", "Make Outcomes Visible", "Position Your POV", "Restraint"], difficulty: "Integrated", status: "Assigned" }
];
const domain = window.TrustBuilderDomain;
const services = window.TrustBuilderServices;
const seededTemplates = [domain.clone(domain.DEFAULT_TEMPLATE)];
const seededScenarioModels = [domain.clone(domain.DEFAULT_SCENARIO), domain.clone(domain.CLIENT_TRIGGERED_SCENARIO)];
const defaultActivity = { totalResponses: 0, acceptedResponses: 0, rejectedResponses: 0, recent: [], lastResponseAt: null };
const defaults = { role: null, route: "dashboard", stage: "briefing", mode: "HUNT", response: "", justification: "", decision: "", transcriptStatus: "not-started", transcriptConfidence: null, openingAudioRef: null, evaluation: null, conversation: [], conversationAnswer: "", conversationAudioRef: null, conversationError: "", conversationStatus: "not_started", conversationSession: null, currentTurnEvaluation: null, assessmentResult: null, attemptHistory: [], retryComparison: null, voiceStatus: "idle", finalEvaluation: null, attempt: 1, approved: false, reflection: "", reviewTab: "evidence", responseDrafts: {}, users: [], templates: seededTemplates, scenarioModels: seededScenarioModels, selectedTemplateId: domain.DEFAULT_TEMPLATE.id, selectedScenarioId: null, showTemplateEditor: false, showScenarioEditor: false, generatedScenarioDraft: null, showAddUser: false, activity: defaultActivity, flags: { aiFeedback: true, transcription: true, language: true, video: false, branching: true, reports: true } };
let state = { ...defaults, ...JSON.parse(localStorage.getItem("trustbuilder-state") || "{}") };
const analysis = window.TrustBuilderAnalysis;
const simulation = window.TrustBuilderSimulation;
let conversationRequestInFlight = false;
let hydratedRole = "";
let auth = { status: "checking", user: null, view: "login", error: "", message: "", accountType: "participant" };
const useCaseWorkspaceState = { items: [], proposals: [], selectedId: "", detail: null, detection: null, composerText: "", answerText: "", error: "", hydrated: false };
let useCaseProbeInFlight = false;
if (!Array.isArray(state.conversation)) state.conversation = [];
if (!Array.isArray(state.users)) state.users = [];
if (!Array.isArray(state.templates) || !state.templates.length) state.templates = seededTemplates.map(item=>domain.clone(item));
if (!Array.isArray(state.scenarioModels) || !state.scenarioModels.length) state.scenarioModels = seededScenarioModels.map(item=>domain.clone(item));
if (!Array.isArray(state.attemptHistory)) state.attemptHistory=[];
if (!state.responseDrafts || typeof state.responseDrafts !== "object" || Array.isArray(state.responseDrafts)) state.responseDrafts = {};
state.activity = { ...defaultActivity, ...(state.activity || {}) };
if (!Array.isArray(state.activity.recent)) state.activity.recent = [];
if (!["HUNT","FARM","MINE"].includes(state.mode)) state.mode = "HUNT";
const navs = {
  participant: [["dashboard","Dashboard"],["scenarios","My scenarios"],["practice","Practice"],["profile","Capability profile"],["language","Language profile"],["progress","Progress"],["reflections","Reflections"]],
  facilitator: [["dashboard","Facilitator dashboard"],["usecases","Use Cases"],["cohorts","Cohorts"],["participants","Participants"],["library","Scenario library"],["assignments","Assignments"],["reviews","Reviews"],["reports","Reports"],["rubrics","Rubrics"]],
  administrator: [["dashboard","System overview"],["users","User management"],["templates","Template management"],["library","Scenario management"],["cohorts","Cohort management"],["rubrics","Rubric management"],["ai","AI settings"],["flags","Feature flags"],["audit","Audit log"]]
};
const save = () => localStorage.setItem("trustbuilder-state", JSON.stringify(state));
const esc = (v="") => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const normalizeRole = value => {
  if (typeof value !== "string") return null;
  const role = value.trim().toLowerCase();
  return ["participant", "facilitator", "administrator"].includes(role) ? role : null;
};
const currentRole = () => {
  if (auth.user) return normalizeRole(auth.user.role);
  return normalizeRole(state.role);
};
const tag = t => `<span class="tag">${t}</span>`;
const badge = t => `<span class="status ${t.toLowerCase().replaceAll(" ","-")}">${t}</span>`;
const metric = (l,v,n) => `<article class="card metric"><span class="eyebrow">${l}</span><strong>${v}</strong><small>${n}</small></article>`;
function toast(message) { document.body.insertAdjacentHTML("beforeend", `<div class="toast" role="status">${message}</div>`); setTimeout(() => document.querySelector(".toast")?.remove(), 2600); }
function authScreen() {
  const register = auth.view === "register";
  return `<main class="auth-page"><section class="auth-intro"><div class="auth-brand"><span class="brand-mark">T</span><strong>TrustBuilder</strong></div><div><div class="eyebrow">Client engagement lab</div><h1>Practice the judgement behind trusted client relationships.</h1><p>Build the evidence, restraint, and point of view that make difficult client conversations productive.</p></div></section><section class="auth-panel"><div class="auth-tabs"><button class="${!register ? "active" : ""}" data-auth-view="login">Login</button><button class="${register ? "active" : ""}" data-auth-view="register">Create Account</button></div><div class="eyebrow">${register ? "Choose your account type" : "Login as"}</div><h2>${register ? "Create your account" : "Sign in to TrustBuilder"}</h2><p>${register ? "Save your progress and practice both client scenarios." : "Continue your client engagement practice."}</p><div class="account-type-grid">${["participant", "facilitator", "administrator"].map(type => `<button type="button" class="account-type-card ${auth.accountType === type ? "selected" : ""}" data-auth-role="${type}"><span>${type === "participant" ? "Participant" : type === "facilitator" ? "Facilitator" : "Administrator"}</span><small>${type === "participant" ? "Practice scenarios and generate evidence." : type === "facilitator" ? "Review progress and manage discovery." : "Govern the workspace and configuration."}</small></button>`).join("")}</div>${auth.error ? `<div class="auth-error" role="alert">${esc(auth.error)}</div>` : ""}${auth.message ? `<div class="auth-success" role="status">${esc(auth.message)}</div>` : ""}<form id="authForm" class="auth-form">${register ? `<div class="form-group"><label for="authName">Full Name</label><input id="authName" name="name" autocomplete="name" required></div>` : ""}<div class="form-group"><label for="authEmail">Email Address</label><input id="authEmail" name="email" type="email" autocomplete="email" required></div><div class="form-group"><label for="authPassword">Password</label><input id="authPassword" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" required></div>${register ? `<div class="form-group"><label for="authConfirmPassword">Confirm Password</label><input id="authConfirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required></div>` : ""}<button class="btn auth-submit" type="submit">${register ? "Create Account" : "Login"}</button></form><button class="auth-link" data-auth-view="${register ? "login" : "register"}">${register ? "Already have an account? Login" : "Need an account? Create Account"}</button></section></main>`;
}
function renderAuth() {
  document.querySelector("#app").innerHTML = auth.status === "checking" ? `<main class="auth-page auth-loading"><div class="auth-brand"><span class="brand-mark">T</span><strong>TrustBuilder</strong></div><p>Checking your session…</p></main>` : authScreen();
  document.querySelectorAll("[data-auth-role]").forEach(button => button.onclick = () => { auth.accountType = button.dataset.authRole || "participant"; auth.error = ""; auth.message = ""; renderAuth(); });
  document.querySelectorAll("[data-auth-view]").forEach(button => button.onclick = () => { auth.view = button.dataset.authView; auth.error = ""; auth.message = ""; renderAuth(); });
  const form = document.querySelector("#authForm");
  if (!form) return;
  form.onsubmit = async event => {
    event.preventDefault(); auth.error = ""; auth.message = "";
    const values = Object.fromEntries(new FormData(form));
    if (auth.view === "register") {
      if (values.password !== values.confirmPassword) { auth.error = "Passwords do not match."; return renderAuth(); }
      if (values.password.length < 8) { auth.error = "Password must be at least 8 characters."; return renderAuth(); }
      try { await services.registerAccount({ name: values.name, email: values.email, password: values.password, role: auth.accountType || "participant" }); auth.view = "login"; auth.message = "Account created successfully. Please log in."; renderAuth(); } catch (error) { auth.error = error.message; renderAuth(); }
      return;
    }
    try {
      const result = await services.loginAccount({ email: values.email, password: values.password });
      const role = normalizeRole(result.user?.role);
      const intendedRole = normalizeRole(auth.accountType);
      if (!role) {
        auth.error = "This session is missing a valid role. Please log in again or contact support.";
        auth.status = "unauthenticated";
        state.role = null;
        renderAuth();
        return;
      }
      if (intendedRole && role !== intendedRole) {
        auth.error = `These credentials belong to a ${role.charAt(0).toUpperCase() + role.slice(1)} account. Please select ${role.charAt(0).toUpperCase() + role.slice(1)} or use the correct account.`;
        auth.status = "unauthenticated";
        state.role = null;
        renderAuth();
        return;
      }
      auth.user = { ...result.user, role };
      auth.status = "authenticated";
      state.role = role;
      state.route = "dashboard";
      save();
      render();
      hydrateServerContent(true);
    } catch (error) { auth.error = error.code === "INVALID_CREDENTIALS" ? "Invalid email or password." : error.message; renderAuth(); }
  };
}
async function logout() { try { await services.logoutAccount(); } catch {} auth.user = null; auth.status = "unauthenticated"; auth.view = "login"; auth.error = ""; auth.message = "You have been logged out."; state.role = null; Object.assign(useCaseWorkspaceState,{items:[],proposals:[],selectedId:"",detail:null,detection:null,composerText:"",answerText:"",error:"",hydrated:false}); localStorage.removeItem("trustbuilder-state"); renderAuth(); }
function currentPhase() {
  const accepted = state.conversation.filter(turn=>turn.role==="participant"&&turn.accepted).length;
  return ({briefing:1,response:2,retry:2,evidence:3,conversation:accepted<2?4:5,finalEvaluation:6,submitted:6,feedback:6,reflection:6,completed:6})[state.stage] || 1;
}
function recordResponseActivity(kind, text, accepted=true) {
  const entry = { id: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`, kind, text: text.trim().slice(0, 140), accepted, createdAt: new Date().toISOString() };
  state.activity.totalResponses += 1;
  state.activity.acceptedResponses += accepted ? 1 : 0;
  state.activity.rejectedResponses += accepted ? 0 : 1;
  state.activity.lastResponseAt = entry.createdAt;
  state.activity.recent = [entry, ...state.activity.recent].slice(0, 6);
}
function activeTemplate() { return state.templates.find(item=>item.id===state.selectedTemplateId) || state.templates[0] || domain.DEFAULT_TEMPLATE; }
function activeScenarioModel() { return state.scenarioModels.find(item=>item.id===state.selectedScenarioId) || null; }
function currentScenarioForPractice() { return scenarioRecord() || activeScenarioModel() || state.scenarioModels[0] || SCENARIOS[0] || null; }
function currentDraftKey() { return state.selectedScenarioId || ""; }
function currentDraft() { return state.selectedScenarioId ? state.responseDrafts[state.selectedScenarioId] || null : null; }
function currentEditableResponse() { return currentDraft()?.response ?? state.response; }
function currentEditableJustification() { return currentDraft()?.justification ?? state.justification; }
function loadCurrentDraft() {
  const draft = currentDraft();
  state.response = draft?.response || "";
  state.justification = draft?.justification || "";
  state.decision = draft?.decision || "";
  state.transcriptStatus = draft?.transcriptStatus || "not-started";
  state.transcriptConfidence = draft?.transcriptConfidence ?? null;
}
function scenarioRecord(id = state.selectedScenarioId) {
  if (!id) return null;
  const model = state.scenarioModels.find(item => item.id === id) || {};
  const library = SCENARIOS.find(item => item.id === id) || {};
  const scenario = { ...library, ...model };
  const template = state.templates.find(item => item.id === scenario.templateId) || activeTemplate();
  const resolved = domain.resolveScenario(scenario, template).scenario;
  if (!model.objective && !library.objective) resolved.objective = template.objective;
  if (!model.openingSituation && !library.openingSituation) resolved.openingSituation = `What is your response to this situation: ${resolved.context || "the current client concern"}?`;
  if (!model.expectedBehaviors && !library.expectedBehaviors) resolved.expectedBehaviors = template.dos.slice(0, 4);
  return resolved;
}
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`; }
function downloadCsv(filename, headers, rows) {
  if (!rows.length) return false;
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  return true;
}
function syncConversationSession(session) {
  if (!session) return;
  state.conversationSession = session;
  state.conversationStatus = session.status;
  const evaluations = new Map((session.evaluations || []).map(item=>[item.id,item]));
  state.conversation = (session.conversationHistory || []).map(turn=>{
    if(turn.role==="ai") return {role:"ai",text:turn.text,phase:turn.phase||4,rationaleCode:turn.decision||turn.rationaleCode,createdAt:turn.timestamp};
    const evaluation=evaluations.get(turn.evaluationId);
    const accepted=evaluation ? evaluation.relevance.classification!=="irrelevant" : true;
    return {role:"participant",text:turn.text||turn.originalResponse,accepted,validation:evaluation?{relevant:accepted,flags:accepted?[]:["off-topic"],message:evaluation.relevance.missingInformation?.[0]||"Address the current question."}:null,audioRef:turn.audioReference||null,phase:(turn.acceptedTurnNumber||turn.turnNumber)<2?4:5,createdAt:turn.timestamp};
  });
}
function responseStatusLabel() {
  if(conversationRequestInFlight||state.conversationStatus==="evaluating") return ["AI is thinking…","Your response is being evaluated silently."];
  if(state.conversationStatus==="ai_turn") return ["AI is responding…","The next stakeholder message is being prepared."];
  if(state.conversationStatus==="completed") return ["Assessment complete","The evidence is ready for final review."];
  return ["Your turn","Respond by voice or text."];
}

function shell(body) {
  const role = currentRole();
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Session role unavailable";
  const info = auth.user ? [auth.user.name.split(/\s+/).map(part => part[0]).join("").slice(0,2).toUpperCase(), auth.user.name, `${roleLabel} · ${auth.user.email}`] : ["TB","TrustBuilder","Guest"];
  const nav = role && navs[role] ? navs[role] : [];
  return `<a class="skip" href="#main">Skip to main content</a><div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">T</span>TrustBuilder</div><div><div class="eyebrow">${role==="participant"?"Develop":"Manage"}</div><nav class="nav">${nav.map(([k,l])=>`<button data-route="${k}" class="${state.route===k?"active":""}">${l}</button>`).join("")}</nav></div><div class="profile"><span class="avatar">${info[0]}</span><span><strong>${esc(info[1])}</strong><small>${esc(info[2])}</small></span></div></aside><section class="main"><header class="topbar"><span class="eyebrow">Client engagement lab</span><div class="topbar-actions"><span class="role-badge">${roleLabel}</span><button class="btn secondary compact" data-action="logout">Logout</button></div></header><main class="content" id="main">${body}</main></section></div>`;
}
function bars() { return `<div class="capabilities">${CAPABILITIES.map(c=>`<div class="cap-row"><span>${c.name}</span><div class="bar" aria-label="${c.name}: ${c.score} out of 5"><span style="width:${c.score/5*100}%"></span></div><strong>${c.score}</strong></div>`).join("")}</div>`; }
function participantHomeLegacy() { return `<section class="welcome"><div><div class="eyebrow">Wednesday, 26 August</div><h1>Good morning, Alex.</h1><p>One deliberate practice now can change your next client conversation.</p></div><button data-route="progress" class="btn secondary">View progress</button></section><section class="card priority"><div class="eyebrow">Current development priority</div><h2>Pause before committing when the evidence is incomplete.</h2><p>Your last two attempts showed strong ownership, but you moved to a firm recommendation before confirming the client’s operating constraint.</p><div class="priority-actions"><button data-action="openScenario" class="btn">Practise this skill</button><button data-route="profile" class="btn secondary">See supporting evidence</button></div></section><div class="metric-row">${metric("Scenario streak","4 weeks","One more practice keeps it going")}${metric("Retry improvement","+0.8","Average capability delta")}${metric("Completed","7 of 9","Two assigned scenarios remain")}</div><div class="grid"><article class="card"><div class="card-head"><div><div class="eyebrow">Capability profile</div><h2>Where you are now</h2></div>${tag("Latest approved")}</div>${bars()}</article><article class="card scenario"><div class="eyebrow">Next assigned scenario</div><h2>${SCENARIOS[0].title}</h2><p>${SCENARIOS[0].context}</p><div class="scenario-meta">${tag("Judgement & Restraint")}${tag("8 min")}</div><button data-action="openScenario" class="btn">Open briefing</button></article></div><article class="card feedback"><div class="card-head"><div><div class="eyebrow">Recent facilitator feedback</div><h2>Observation from your last retry</h2></div>${tag("The Silent Escalation")}</div><p class="quote">You acknowledged the concern and asked who was affected before proposing action. Next, name the evidence you still need and set a precise time to return with an answer.</p></article>`; }
function participantHome() {
  const activity = state.activity;
  const phase = currentPhase();
  const userName = auth.user?.name || "Participant";
  const assignedScenario = activeScenarioModel();
  const recent = activity.recent.length ? activity.recent.map(item=>`<li><span class="activity-state ${item.accepted?"accepted":"rejected"}">${item.accepted?"Accepted":"Revise"}</span><span><strong>${esc(item.kind)}</strong><small>${esc(item.text || "Audio response captured")}</small></span><time>${new Date(item.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</time></li>`).join("") : `<li class="activity-empty"><span>No responses recorded in this run yet.</span></li>`;
  const scenarioBlock = assignedScenario ? `<section class="card priority"><div class="eyebrow">Current scenario focus</div><h2>${esc(assignedScenario.title)}</h2><p>${esc(assignedScenario.context || assignedScenario.objective || "No scenario details are available yet.")}</p><div class="priority-actions"><button data-action="openScenario" class="btn">Open briefing</button><button data-route="profile" class="btn secondary">See capability profile</button></div></section>` : `<section class="card priority empty"><div class="eyebrow">Scenario status</div><h2>No scenario assigned yet.</h2><p>Once a facilitator or administrator assigns a scenario, it will appear here and drive the practice experience.</p></section>`;
  const recommendation = assignedScenario ? (assignedScenario.expectedBehaviors?.[0] || assignedScenario.objective || "Review the scenario brief and prepare an evidence-based response.") : "Wait for an assigned scenario to start practice.";
  return `<section class="welcome"><div><div class="eyebrow">Welcome back</div><h1>${esc(userName)}</h1><p>Continue with the active scenario, evidence, and progress that are available to your account.</p></div><button data-route="progress" class="btn secondary">View progress</button></section>${scenarioBlock}<div class="metric-row">${metric("Responses", String(activity.totalResponses), activity.totalResponses ? "Recorded in the current session" : "No responses yet")}${metric("Accepted", String(activity.acceptedResponses), "Assessment actions accepted so far")}${metric("Scenario", assignedScenario ? "1 active" : "None assigned", assignedScenario ? assignedScenario.title : "No scenario is currently assigned")}</div><article class="card response-dashboard"><div class="card-head"><div><div class="eyebrow">Live response dashboard</div><h2>Recent activity</h2></div>${tag(`Phase ${phase} of 6`)}</div><div class="response-progress" aria-label="Phase ${phase} of 6 complete"><span style="width:${phase/6*100}%"></span></div><div class="response-stats"><div><strong>${activity.totalResponses}</strong><span>Responses</span></div><div><strong>${activity.acceptedResponses}</strong><span>Accepted</span></div><div><strong>${activity.rejectedResponses}</strong><span>Needs revision</span></div></div><ul class="activity-list">${recent}</ul></article><div class="grid"><article class="card"><div class="card-head"><div><div class="eyebrow">Capability profile</div><h2>Where you are now</h2></div>${tag("Latest approved")}</div>${bars()}</article><article class="card scenario"><div class="eyebrow">Recommended focus</div><h2>${esc(assignedScenario ? assignedScenario.expectedBehaviors?.[0] || "Scenario-specific practice" : "Awaiting assignment")}</h2><p>${esc(recommendation)}</p>${assignedScenario ? `<div class="scenario-meta">${(assignedScenario.expectedBehaviors || []).slice(0, 2).map(item => tag(item)).join("")}</div>` : ""}</article></div>`;
}
function scenarioList() {
  const items = state.scenarioModels.length ? state.scenarioModels : SCENARIOS;
  if (!items.length) {
    return `<div class="page-head"><div><div class="eyebrow">Assigned learning</div><h1>Choose a scenario</h1><p>No published scenarios are available from the current workspace yet.</p></div></div><article class="card empty"><strong>No scenarios assigned</strong><p>Once a scenario is published, it will appear here for the participant to select.</p></article>`;
  }
  return `<div class="page-head"><div><div class="eyebrow">Assigned learning</div><h1>Choose a scenario</h1><p>Practice the judgement behind trusted client relationships.</p></div></div><div class="scenario-grid scenario-catalog">${items.map(s=>`<article class="card scenario-card scenario-card-${s.id}"><div class="card-head"><span class="scenario-type">${esc(s.type || "Practice scenario")}</span><span class="scenario-domain">${esc(s.domain || s.difficulty || "Developing")}</span></div><h2>${esc(s.title)}</h2>${s.clientStatement?`<p class="client-statement">“${esc(s.clientStatement)}”</p>`:`<p>${esc(s.context || "No scenario context has been published yet.")}</p>`}<div class="scenario-detail"><small>Context</small><span>${esc(s.context || "No context available")}</span></div><div class="scenario-detail"><small>IMPACT+R emphasis</small><span>${(s.impactEmphasis || []).map(esc).join(" · ") || "No emphasis defined yet"}</span></div><div class="scenario-detail"><small>Capability focus</small><span>${(s.caps || s.evaluationCriteria || []).map(esc).join(" · ") || "No capability focus defined yet"}</span></div><button class="btn" data-action="openScenarioDetails" data-scenario="${s.id}">Select scenario</button></article>`).join("")}</div>`;
}
function scenarioDetails() {
  const scenario = scenarioRecord();
  const capabilities = scenario.caps || scenario.capabilities || ["Judgement & Restraint", "Professional Speech Excellence"];
  const expected = scenario.expectedBehaviors || ["Acknowledge the stakeholder concern", "Use verified evidence", "Set a precise next action"];
  const dos = scenario.dos || activeTemplate().dos;
  const donts = scenario.donts || activeTemplate().donts;
  const evaluationCriteria = scenario.evaluationCriteria || activeTemplate().evaluationCriteria || [];
  const practicePrompts = [
    { title: "First probe", text: scenario.openingSituation || "Respond to the stakeholder’s current concern." },
    { title: "Evidence check", text: scenario.possibleConversationDirections?.[0] ? `Use the scenario’s strongest evidence path: ${scenario.possibleConversationDirections.join(" · ")}.` : "Anchor the answer in observable facts before offering a recommendation." },
    { title: "Commercial challenge", text: scenario.clientStatement || "Keep the answer client-ready, specific, and constrained by what is actually known." }
  ];
  return `<div class="page-head"><div><div class="eyebrow">Practice scenario · ${esc(scenario.difficulty || "Developing")}</div><h1>${esc(scenario.title)}</h1><p>${esc(scenario.context)}</p></div>${badge(scenario.status || "Practice")}</div><div class="grid scenario-detail-grid"><article class="card"><div class="card-head"><div><div class="eyebrow">Scenario brief</div><h2>What this practice assesses</h2></div>${tag(`${scenario.estimatedMinutes || 8} min`)}</div><div class="brief-grid"><div class="brief-item"><small>Objective</small><strong>${esc(scenario.objective || activeTemplate().objective)}</strong></div><div class="brief-item"><small>Participant role</small><strong>${esc(scenario.participantRole || "Engagement delivery lead")}</strong></div><div class="brief-item"><small>Other stakeholder</small><strong>${esc(scenario.otherRole || "Client sponsor")}</strong></div><div class="brief-item"><small>Opening message</small><strong>${esc(scenario.openingSituation || "Respond to the stakeholder's current concern.")}</strong></div></div><h3 class="detail-heading">Capabilities being assessed</h3><div class="tag-list">${capabilities.map(tag).join(" ")}</div><h3 class="detail-heading">Expected behaviours</h3><ul>${expected.map(item => `<li>${esc(item)}</li>`).join("")}</ul><h3 class="detail-heading">Scenario-specific practice prompts</h3><div class="scenario-practice-grid">${practicePrompts.map(item => `<article class="scenario-practice-card"><strong>${esc(item.title)}</strong><p>${esc(item.text)}</p></article>`).join("")}</div><h3 class="detail-heading">Evaluation criteria for this scenario</h3><div class="tag-list">${evaluationCriteria.map(tag).join(" ")}</div><div class="actions"><button class="btn secondary" data-route="practice">Back to practice</button><button class="btn" data-action="startSelectedScenario">Start practice</button></div></article><aside class="card"><div class="eyebrow">Conversation expectations</div><h2>Evidence before commitment</h2><p>Respond directly, make uncertainty clear, and agree a responsible next step. The adaptive client conversation will test the evidence behind your answer.</p><h3 class="detail-heading">Relevant Do's</h3><ul>${dos.map(item => `<li>${esc(item)}</li>`).join("")}</ul><h3 class="detail-heading">Relevant Don'ts</h3><ul>${donts.map(item => `<li>${esc(item)}</li>`).join("")}</ul></aside></div>`;
}
function steps() { const all=["Briefing","Response","Evidence","Conversation","Challenge","Evaluation"], map={briefing:0,response:1,evidence:2,conversation:Math.min(4,3+Math.floor(state.conversation.filter(t=>t.role==="participant"&&t.accepted).length/2)),finalEvaluation:5,submitted:5,feedback:5,retry:1,reflection:5,completed:6}, current=map[state.stage]??0; return `<div class="steps six-phase">${all.map((x,i)=>`<span class="step ${i<current?"done":i===current?"current":""}"><i>${i<current?"✓":i+1}</i><span>Phase ${i+1}<small>${x}</small></span></span>`).join("")}</div>`; }

function phaseThreeEvidence() {
  const evaluation = state.evaluation || analysis.evaluateResponse(state.response, state.decision);
  return `<div class="eyebrow">Phase 3 · Evidence check</div><h1>Review the evidence before the live simulation.</h1><p>The same live audio and verified transcript remain the source evidence. These observations are provisional and will be reconsidered with the phase 4–5 interaction.</p><div class="feedback-grid">${evaluation.evidence.slice(0,4).map(item=>`<div class="feedback-panel"><h3>${item.dimension}</h3><p>${item.quote}</p>${badge(item.observed?"Observed":"Review required")}</div>`).join("")}</div><div class="notice" style="margin-top:16px"><strong>Human-in-the-loop:</strong> no score is final at this stage. The complete interaction will be evaluated in phase 6 and reviewed by a facilitator.</div><div class="actions"><button class="btn secondary" data-stage="response">Edit response</button><button class="btn" data-action="startConversation">Begin AI client conversation</button></div>`;
}

function conversationView() {
  const accepted = state.conversation.filter(turn=>turn.role==="participant"&&turn.accepted).length;
  const phase = accepted < 2 ? 4 : 5;
  const lastAI = [...state.conversation].reverse().find(turn=>turn.role==="ai");
  return `<div class="conversation-shell"><div class="conversation-head"><div><div class="eyebrow">Phase ${phase} · ${phase===4?"Adaptive discovery":"Commercial challenge"} · ${state.mode}</div><h1>AI-led client conversation</h1><p>One question at a time. The next question unlocks only after a relevant, evidence-supported answer.</p></div><span class="voice-state ${state.voiceStatus}"><span></span>${state.voiceStatus==="speaking"?"AI speaking":"Voice + text"}</span></div><div class="conversation-log" aria-live="polite">${state.conversation.map((turn,index)=>`<article class="turn ${turn.role}"><div class="turn-avatar">${turn.role==="ai"?"AI":"AM"}</div><div><small>${turn.role==="ai"?"Client simulator":turn.accepted?"Participant · accepted":"Participant · needs revision"}</small><p>${esc(turn.text)}</p>${turn.validation?.flags?.length?`<div class="validation-flags">${turn.validation.flags.map(flag=>badge(flag.replaceAll("-"," "))).join("")}</div>`:""}</div></article>`).join("")}</div>${state.conversationError?`<div class="response-rejected" role="alert"><strong>Response not accepted</strong><p>${esc(state.conversationError)}</p></div>`:""}<div class="conversation-answer"><div class="card-head"><div><div class="eyebrow">Your response</div><h2>Answer the client’s current question</h2></div>${lastAI?`<button class="btn secondary compact" data-action="replayAI">Replay AI voice</button>`:""}</div><div class="recorder"><span><span class="record-dot"></span><strong id="conversationRecordStatus">Microphone ready</strong><small id="conversationRecordDetail" style="display:block;color:var(--muted);margin-top:4px">Speak naturally or use the text fallback.</small></span><button class="btn secondary" data-action="recordConversation">Start speaking</button></div><div id="conversationAudio"></div><div class="form-group"><label for="conversationAnswer">Live transcript / text fallback</label><textarea id="conversationAnswer" placeholder="Address the client’s question with relevant evidence, judgement, and a next action.">${esc(state.conversationAnswer||"")}</textarea><small id="conversationInterim" style="color:var(--muted)" aria-live="polite"></small></div><div class="actions"><button class="btn" data-action="submitConversationAnswer">Submit relevant answer</button></div></div></div>`;
}

function scoreLevel(score) { return ["","Emerging","Inconsistent","Functional","Strong","Trusted-Advisor Level"][score] || "Not assessed"; }
function finalEvaluationView() {
  const result = state.finalEvaluation;
  if (!result) return `<div class="empty"><h1>Preparing the phase 6 evaluation…</h1><p>The complete transcript and AI interaction are being assembled.</p><button class="btn" data-action="generateFinalEvaluation">Generate evaluation</button></div>`;
  return `<div class="eyebrow">Phase 6 · Draft evaluation</div><h1>Evidence across the complete client conversation</h1><p>Scores use the existing five-level methodology and remain draft until facilitator approval.</p><div class="notice"><strong>${result.status.replaceAll("_"," ")}</strong> · ${result.interactionTurns} accepted AI conversation responses · ${result.mode} mode</div><div class="evaluation-columns"><section><h2>Six capability metrics</h2><div class="evaluation-list">${result.capabilityScores.map(item=>`<article><div class="score-orb">${item.score}</div><div><strong>${item.name}</strong><small>${scoreLevel(item.score)}</small><p>${esc(item.evidence)}</p></div></article>`).join("")}</div></section><section><h2>IMPACT+R commercial metrics</h2><div class="impact-grid">${result.impactScores.map(item=>`<article><span>${item.code}</span><strong>${item.score}</strong><small>${item.name}</small><p>${esc(item.evidence)}</p></article>`).join("")}</div></section></div><div class="feedback-grid" style="margin-top:20px"><div class="feedback-panel"><h3>Strengths</h3><ul>${(result.strengths.length?result.strengths:["No capability has enough evidence for a strong rating yet."]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="feedback-panel"><h3>Development needs</h3><ul>${(result.weaknesses.length?result.weaknesses:["Facilitator should calibrate the functional-level evidence."]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="feedback-panel"><h3>Targeted practice</h3><ul>${result.targetedPractice.map(x=>`<li><strong>${esc(x.title)}</strong><br>${esc(x.focus)}</li>`).join("")}</ul></div></div><div class="actions"><button class="btn secondary" data-action="restartConversation">Retry AI conversation</button><button class="btn" data-action="sendForReview">Send to facilitator review</button></div>`;
}
function scenario() {
  const active = scenarioRecord();
  if (!active) {
    return `<div class="page-head"><div><div class="eyebrow">Practice scenario</div><h1>No scenario assigned</h1><p>Choose a published scenario from the scenario list before starting practice.</p></div></div><article class="card empty"><strong>No active scenario</strong><p>The participant view will render the selected scenario here once one has been assigned or published.</p></article>`;
  }
  let b = "";
  const questionPrompt = active.clientStatement || active.openingSituation || "Respond using the scenario objective, evidence, and next action.";
  const modePanel = `<div class="mode-panel"><div><small class="eyebrow">Commercial mode</small><strong>Preserved throughout all six phases</strong></div><div class="mode-switch" role="group" aria-label="Commercial scenario mode">${["HUNT","FARM","MINE"].map(mode=>`<button class="${state.mode===mode?"active":""}" data-mode="${mode}">${mode}</button>`).join("")}</div></div>`;

  if (state.stage === "briefing") {
    b = `<div class="eyebrow">Phase 1 · ${esc(active.type || "Practice scenario")} · ${esc(active.domain || active.difficulty || "Developing")}</div><h1>${esc(active.title)}</h1><p>${esc(active.context || active.objective || "No context has been published for this scenario yet.")}</p><div class="brief-grid"><div class="brief-item"><small>Objective</small><strong>${esc(active.objective || activeTemplate().objective)}</strong></div><div class="brief-item"><small>Your role</small><strong>${esc(active.participantRole || "Engagement delivery lead")}</strong></div><div class="brief-item"><small>Stakeholder</small><strong>${esc(active.otherRole || "Client sponsor")}</strong></div><div class="brief-item"><small>Opening message</small><strong>${esc(active.openingSituation || questionPrompt)}</strong></div></div>${modePanel}<p class="callout"><strong>Conversation expectation:</strong> Use evidence, make uncertainty clear, and agree a precise next action.</p><div class="actions"><button class="btn" data-stage="response">I’m ready</button></div>`;
  } else if (state.stage === "response" || state.stage === "retry") {
    const responseTitle = active.clientStatement || active.openingSituation || "Respond to the stakeholder’s current concern.";
    const responseBody = active.clientStatement ? "Use the scenario objective and the available evidence to respond clearly and specifically." : (active.openingSituation || "Prepare a concise response grounded in observable facts.");
    b = `<div class="eyebrow">${state.stage === "retry" ? "Retry · changed constraint" : "Stakeholder request"}</div><h1>“${esc(responseTitle)}”</h1><p>${esc(responseBody)}</p><div class="form-group"><label>Choose your immediate action</label><div class="choice-list">${["Respond immediately","Ask a clarifying question","Acknowledge and pause","Validate before responding","Give a limited answer"].map(x=>`<label class="choice"><input type="radio" name="decision" value="${x}" ${state.decision===x?"checked":""}>${x}</label>`).join("")}</div></div><div class="recorder"><span><span class="record-dot"></span><strong id="recordStatus">${state.transcriptStatus === "partial" ? "Draft transcript ready for review" : "Microphone ready"}</strong><small id="recordDetail" style="display:block;color:var(--muted);margin-top:4px">Audio is preserved independently from the transcript.</small></span><button class="btn secondary" data-action="record">Start recording</button></div><div id="audioReview">${analysis.runtime.audioUrl ? `<audio controls src="${analysis.runtime.audioUrl}" style="width:100%;margin-top:12px"></audio>` : ""}</div><div class="form-group"><label for="responseText">Editable transcript <span class="status ${state.transcriptStatus === "completed" ? "approved" : "pending"}">${state.transcriptStatus === "completed" ? "Provider verified" : "Review required"}</span></label><textarea id="responseText" placeholder="The live draft appears here. Correct names, numbers, and technical terms against the recording.">${esc(currentEditableResponse())}</textarea><small id="transcriptHint" style="color:var(--muted)">${state.transcriptConfidence ? `Draft recognition confidence: ${Math.round(state.transcriptConfidence * 100)}%. ` : ""}The participant or facilitator should verify the transcript against the audio or other evidence before proceeding.</small></div><div class="actions"><button class="btn secondary" data-action="saveDraft">Save draft</button><button class="btn" data-action="submitResponse">Submit response</button></div>`;
  } else if (state.stage === "evidence") {
    b = phaseThreeEvidence();
  } else if (state.stage === "conversation") {
    b = conversationView();
  } else if (state.stage === "finalEvaluation") {
    b = finalEvaluationView();
  } else if (state.stage === "submitted") {
    b = `<div class="empty">${tag("Submitted safely")}<h1>Your six-phase interaction is awaiting facilitator review.</h1><p>The original audio, verified transcript, adaptive AI Q&amp;A, capability evidence, and IMPACT+R draft are preserved. Nothing publishes until a facilitator approves it.</p><button class="btn secondary" data-route="dashboard">Return to dashboard</button></div>`;
  } else if (state.stage === "feedback") {
    b = `<div class="eyebrow">Facilitator-approved feedback</div><h1>Apply the scenario-specific guidance.</h1><div class="feedback-grid"><div class="feedback-panel"><h3>Thinking</h3><p>${esc(active.expectedBehaviors?.[0] || "Use the scenario objective and evidence to answer the stakeholder directly.")}</p></div><div class="feedback-panel"><h3>Behaviour</h3><p>${esc(active.dos?.[0] || "Maintain professional tone and evidence discipline.")}</p></div><div class="feedback-panel"><h3>Communication</h3><p>${esc(active.donts?.[0] || "Avoid unsupported promises and unclear next steps.")}</p></div></div><div class="card" style="box-shadow:none;margin-top:18px"><h3>Stronger alternative</h3><p class="quote">Tie the response to the scenario objective, make uncertainty explicit, and name the precise evidence or next checkpoint that will close the gap.</p><h3>Retry focus</h3><p>Use the scenario-specific expected behaviours and evaluation criteria to sharpen the next response.</p></div><div class="actions"><button class="btn" data-stage="retry">Start retry variation</button></div>`;
  } else if (state.stage === "reflection") {
    b = `<div class="eyebrow">Close the learning loop</div><h1>Reflection</h1><p>Capture what you learned from this scenario and what you will apply next time.</p><div class="form-group"><label for="reflectionText">What did you initially miss, and what will you apply next time?</label><textarea id="reflectionText">${esc(state.reflection)}</textarea></div><div class="actions"><button class="btn" data-action="completeReflection">Complete scenario</button></div>`;
  } else {
    b = `<div class="empty">${tag("Learning loop complete")}<h1>The scenario has been completed.</h1><p>Your approved attempt, retry comparison, and reflection are now part of your profile.</p><button class="btn" data-route="profile">View updated profile</button></div>`;
  }
  return `<div class="workspace">${steps()}<article class="card">${b}</article></div>`;
}
function profile() { return `<div class="page-head"><div><div class="eyebrow">Evidence, not averages</div><h1>Capability profile</h1><p>Scores shown here come only from facilitator-approved assessments.</p></div>${tag("Updated 24 Aug")}</div><div class="grid"><article class="card"><div class="card-head"><h2>Current capability levels</h2>${tag("5-level rubric")}</div>${bars()}</article><article class="card"><div class="eyebrow">Development priority</div><h2>Judgement & Restraint</h2><p>Move from Functional toward Strong by naming uncertainty without losing ownership.</p><div class="brief-item"><small>Observed evidence</small><strong>Committed before downstream validation was complete.</strong></div><div class="brief-item" style="margin-top:10px"><small>Improvement evidence</small><strong>Retry separated facts from the remaining test.</strong></div></article></div><article class="card feedback"><h2>Baseline to current</h2><div class="table-wrap"><table><thead><tr><th>Capability</th><th>Baseline</th><th>Current</th><th>Change</th><th>Level</th></tr></thead><tbody>${CAPABILITIES.map(c=>`<tr><td>${c.name}</td><td>${c.baseline.toFixed(1)}</td><td><strong>${c.score.toFixed(1)}</strong></td><td>+${(c.score-c.baseline).toFixed(1)}</td><td>${c.score>=3.5?"Strong":"Functional"}</td></tr>`).join("")}</tbody></table></div></article>`; }
function language() { const rows=[["Article omission",7,"Improving","‘share update’ → ‘share an update’"],["Tense inconsistency",4,"Stable","Shifted tense in incident summary"],["Modal redundancy",3,"Improving","‘might possibly’ → ‘might’"],["Unsuitable register",2,"New","‘guys’ in senior stakeholder response"]]; return `<div class="page-head"><div><div class="eyebrow">Patterns across sessions</div><h1>Personal language profile</h1><p>Language coaching stays connected to client scenarios.</p></div></div><div class="metric-row">${metric("Self-corrections","8","Up from 3 at baseline")}${metric("Recurring patterns","4","Two are improving")}${metric("Clarity trend","+18%","Across six reviewed attempts")}</div><article class="card"><table><thead><tr><th>Pattern</th><th>Frequency</th><th>Trend</th><th>Recent evidence</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${badge(r[2])}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></article>`; }
function reflections() {
  const rows = [
    { scenario: "The Silent Escalation", reflection: "Asked who was affected before proposing action.", changed: "Separated stakeholder impact from the immediate recommendation.", date: "2024-08-24", capability: "Active Listening", score: "3.8", recommendation: "Name the evidence needed before committing." },
    { scenario: "Changing scope", reflection: "Named the trade-off before accepting urgency.", changed: "Explained the delivery consequence and agreed a boundary.", date: "2024-08-16", capability: "Judgement & Restraint", score: "3.6", recommendation: "Set a precise checkpoint for the next decision." }
  ];
  return `<div class="page-head"><div><div class="eyebrow">Transfer to client work</div><h1>Reflections</h1><p>Capture what changed and carry it into the next conversation.</p></div><button class="btn" data-action="exportNotes">Export notes</button></div><article class="card"><div class="table-wrap"><table><thead><tr><th>Scenario</th><th>Reflection</th><th>What changed</th><th>Completed</th><th>Capability</th><th>Score</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.scenario)}</strong></td><td>${esc(row.reflection)}</td><td>${esc(row.changed)}</td><td>${esc(row.date)}</td><td>${esc(row.capability)}</td><td>${esc(row.score)}</td></tr>`).join("")}</tbody></table></div></article>`;
}
function simpleTable(title, eyebrow, headers, rows, action="Create") { const actionName=action==="Export audit"?"exportAudit":"generic"; return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div><button class="btn" data-action="${actionName}">${action}</button></div><article class="card"><div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td>${i===0?`<strong>${c}</strong>`:c}</td>`).join("")}</tr>`).join("")}</tbody></table></div></article>`; }
function facilitatorHome() { return `<div class="page-head"><div><div class="eyebrow">Cohort 01 · August pilot</div><h1>Facilitator dashboard</h1><p>Prioritise human review where judgement, restraint, or business hypotheses are involved.</p></div><button class="btn" data-route="reviews">Review next attempt</button></div><div class="metric-row">${metric("Participants","12","10 active this week")}${metric("Pending reviews","5","2 judgement-critical")}${metric("Completion","78%","42 of 54 assignments")}</div><div class="grid"><article class="card"><div class="card-head"><h2>What needs you now</h2>${badge("Pending")}</div><table><tbody><tr><td>Alex Morgan</td><td>Immediate answer</td><td>${badge("Flagged")}</td></tr><tr><td>Samir Patel</td><td>Contradicted Assumption</td><td>${badge("Pending")}</td></tr></tbody></table></article><article class="card"><div class="eyebrow">Cohort signal</div><h2>Strong ownership; weak evidence boundaries</h2><p>Seven participants moved to recommendations before separating facts, hypotheses, and unresolved evidence.</p><div class="brief-item"><small>Recommended intervention</small><strong>Run a 20-minute pause-and-bound clinic.</strong></div></article></div>`; }
function review() { return `<div class="page-head"><div><div class="eyebrow">Pending human review</div><h1>Alex Morgan · Attempt 1</h1><p>Pressure for an immediate answer · submitted 24 Aug, 14:32</p></div>${badge("Flagged")}</div><div class="notice"><strong>Human sign-off required.</strong> Judgement & Restraint suggestions cannot publish automatically.</div><div class="grid" style="margin-top:20px"><article class="card"><div class="eyebrow">Participant response</div><p class="quote">I understand the urgency. Based on the service restoration, we should be fully recovered by 4pm. I’ll ask the team to confirm.</p><h3>System observations</h3><ul><li>Responded directly to time pressure.</li><li>Committed before downstream evidence was available.</li><li>Follow-through had no return time.</li></ul><p class="notice">AI-generated observation · verify against evidence.</p></article><article class="card"><div class="eyebrow">Rubric scoring</div><h2>Judgement & Restraint</h2><p>AI suggestion: <strong>2 · Inconsistent</strong></p><div class="score-box">${[1,2,3,4,5].map(x=>`<button data-score="${x}" class="${x===2?"selected":""}">${x}</button>`).join("")}</div><div class="form-group"><label>Behavioural evidence and rationale</label><textarea>Moved to a recovery commitment before validation was complete. Showed ownership, but did not bound uncertainty or set a precise checkpoint.</textarea></div><div class="form-group"><label>Feedback draft</label><textarea>Acknowledge the business consequence, separate restored service from unvalidated downstream processing, and commit to a precise update time.</textarea></div><div class="actions"><button class="btn secondary" data-action="saveReview">Save draft</button><button class="btn" data-action="approveFeedback">Approve feedback</button></div></article></div>`; }
function useCaseLines(value) { return Array.isArray(value) ? value.join("\n") : String(value || ""); }
function useCaseKnowledgePanel(title, items, emptyText) {
  const content = (items || []).length
    ? `<ul>` + items.map(item => `<li><strong>` + esc(item.label || item.field || title) + `</strong><span>` + esc(item.value || item) + `</span></li>`).join("") + `</ul>`
    : `<p>` + esc(emptyText) + `</p>`;
  return `<article class="knowledge-card"><h3>` + esc(title) + `</h3>` + content + `</article>`;
}
function useCaseFormField(id, label, value, options = {}) {
  const span = options.wide ? " span-2" : "";
  const control = options.textarea === false
    ? `<input id="` + id + `" value="` + esc(value) + `">`
    : `<textarea id="` + id + `"` + (options.rows ? ` rows="` + options.rows + `"` : "") + `>` + esc(value) + `</textarea>`;
  return `<div class="form-group` + span + `"><label for="` + id + `">` + esc(label) + `</label>` + control + `</div>`;
}
function useCaseEditor(record) {
  const scalar = [
    ["useCaseName", "Name", record.name, false, false],
    ["useCaseDescription", "Description", record.description, true, true],
    ["useCaseObjective", "Objective", record.objective, true, true],
    ["useCaseBusinessProblem", "Business problem", record.businessProblem, true, true],
    ["useCaseDesiredOutcome", "Decision / desired outcome", record.desiredOutcome, true, true],
    ["useCaseTrigger", "Trigger", record.trigger, true, false],
    ["useCaseCurrentProcess", "Current process", record.currentProcess, true, true],
    ["useCaseAiRole", "AI responsibility", record.aiRole, true, false],
    ["useCaseHumanRole", "Human responsibility", record.humanRole, true, false]
  ].map(([id, label, value, textarea, wide]) => useCaseFormField(id, label, value, { textarea, wide, rows: 3 })).join("");
  const listFields = [
    ["useCaseTargetUsers", "Target users", "targetUsers"], ["useCaseStakeholders", "Stakeholders", "stakeholders"],
    ["useCaseInputs", "Inputs / evidence", "inputs"], ["useCaseOutputs", "Outputs", "outputs"],
    ["useCaseDataSources", "Data sources", "dataSources"], ["useCaseSystems", "Systems", "systems"],
    ["useCaseDependencies", "Dependencies", "dependencies"], ["useCaseConstraints", "Constraints", "constraints"],
    ["useCaseAssumptions", "Assumptions", "assumptions"], ["useCaseRisks", "Risks", "risks"],
    ["useCaseSuccessCriteria", "Success criteria", "successCriteria"], ["useCaseKpis", "KPIs", "kpis"],
    ["useCaseEdgeCases", "Edge cases", "edgeCases"], ["useCaseConfirmedFacts", "Confirmed facts", "confirmedFacts"],
    ["useCaseOpenQuestions", "Open questions", "openQuestions"], ["useCaseDecisions", "Decisions", "decisions"]
  ].map(([id, label, key]) => useCaseFormField(id, label + " · one per line", useCaseLines(record[key]), { rows: 3 })).join("");
  return `<details class="use-case-editor"><summary>Edit structured use case</summary><div class="configuration-grid">` + scalar + listFields + `</div><div class="actions"><button class="btn secondary" data-action="saveUseCaseDraft">Save draft</button>` + (record.status === "draft" ? `<button class="btn" data-action="publishUseCase">Publish</button>` : "") + `</div><p class="field-help">Material edits increment the version. Publishing always requires this explicit action.</p></details>`;
}
function useCaseWorkspace() {
  if (!["facilitator", "administrator"].includes(auth.user?.role)) {
    return `<div class="page-head"><div><div class="eyebrow">Facilitator-only workspace</div><h1>Use Cases</h1><p>Sign in with a facilitator or administrator account to manage private discovery data.</p></div></div><div class="notice"><strong>Access boundary:</strong> participant accounts cannot read, create, probe, or publish use cases.</div>`;
  }
  const detail = useCaseWorkspaceState.detail;
  const active = detail?.useCase || null;
  const detection = useCaseWorkspaceState.detection;
  const proposals = useCaseWorkspaceState.proposals || [];
  const detectionPanel = detection?.candidate ? `<article class="use-case-detection"><div><span class="eyebrow">New use case recognised</span><strong>` + esc(detection.candidate.name) + `</strong><p>` + esc(detection.candidate.description) + `</p></div><button class="btn" data-action="createDetectedUseCase">Create draft &amp; start probing</button></article>`
    : detection && detection.detected ? `<div class="response-rejected"><strong>A new use case was mentioned, but its name is unclear.</strong><p>Add a short name, then try again.</p></div>`
    : detection ? `<div class="notice">No explicit new-use-case intent was found. You can still create the text as a manual draft.</div>` : "";
  const proposalsPanel = proposals.length ? `<article class="card use-case-proposals"><div class="card-head"><div><div class="eyebrow">AI-discovered opportunities</div><h2>Proposed use cases</h2></div><span class="tag">` + proposals.length + `</span></div><div class="proposal-list">` + proposals.map(proposal => `<article class="proposal-item"><div class="proposal-meta"><strong>` + esc(proposal.name) + `</strong><span>Confidence ` + Number(proposal.confidence || 0).toFixed(2) + `</span></div><p>` + esc(proposal.description) + `</p><small>` + esc(proposal.rationale) + `</small><div class="actions compact-actions"><button class="btn secondary" data-action="acceptUseCaseProposal" data-proposal-id="` + esc(proposal.id) + `">Create draft</button></div></article>`).join("") + `</div></article>` : `<article class="card use-case-proposals"><div class="card-head"><div><div class="eyebrow">AI-discovered opportunities</div><h2>Proposed use cases</h2></div></div><p class="notice">No AI-discovered opportunities are currently proposed.</p></article>`;
  const list = useCaseWorkspaceState.items.length ? useCaseWorkspaceState.items.map(item => {
    const selected = item.id === useCaseWorkspaceState.selectedId;
    const completeness = item.knowledgeSummary?.completeness ?? domain.deriveUseCaseKnowledgeState(item).completeness;
    return `<button class="use-case-list-item ` + (selected ? "active" : "") + `" data-use-case-id="` + esc(item.id) + `"><span><strong>` + esc(item.name) + `</strong><small>Version ` + Number(item.version || 1) + ` · ` + completeness + `% defined</small></span><span class="status ` + esc(item.status) + `">` + esc(item.status) + `</span></button>`;
  }).join("") : `<div class="empty"><strong>No use cases yet</strong><p>Add one without filling every field upfront.</p></div>`;
  const activePanel = !active ? `<article class="card empty use-case-empty"><strong>Select a use case</strong><p>Choose an existing record or add a draft to begin contextual probing.</p></article>` : (() => {
    const knowledge = detail.knowledgeState || domain.deriveUseCaseKnowledgeState(active);
    const turns = detail.conversation?.turns || [];
    const transcript = turns.length ? turns.map(turn => `<article class="turn ` + (turn.role === "ai" ? "ai" : "participant") + `"><div class="turn-avatar">` + (turn.role === "ai" ? "AI" : "PS") + `</div><div><small>` + (turn.role === "ai" ? "Use-case facilitator" : turn.accepted === false ? "Facilitator · needs clarity" : "Facilitator") + `</small><p>` + esc(turn.text) + `</p>` + (turn.questionReason ? `<span class="probe-reason">Why now: ` + esc(turn.questionReason) + `</span>` : "") + `</div></article>`).join("") : `<p class="empty-probe">No probing conversation yet.</p>`;
    const lastTurn = turns.at(-1);
    const prompt = lastTurn?.role === "ai" && !lastTurn.complete
      ? `<div class="probe-response"><label for="useCaseProbeAnswer">Your answer</label><textarea id="useCaseProbeAnswer" placeholder="Answer the current question with confirmed information.">` + esc(useCaseWorkspaceState.answerText) + `</textarea><div class="actions"><button class="btn" data-action="submitUseCaseProbe" ` + (useCaseProbeInFlight ? "disabled" : "") + `>` + (useCaseProbeInFlight ? "Updating knowledge…" : "Submit answer") + `</button></div></div>`
      : `<div class="actions"><button class="btn" data-action="startUseCaseProbe" ` + (useCaseProbeInFlight ? "disabled" : "") + `>` + (turns.length ? "Find next high-value gap" : "Start AI probing") + `</button></div>`;
    const relationships = (detail.relationships || []).length ? detail.relationships.map(item => {
      const related = useCaseWorkspaceState.items.find(candidate => candidate.id === item.relatedUseCaseId);
      return `<article class="relationship-item"><span class="relationship-type">` + esc(item.type.replaceAll("_", " ")) + `</span><strong>` + esc(related?.name || "Current use case") + `</strong><p>` + esc(item.explanation) + `</p><small>Suggested · facilitator decision remains required` + (item.direction ? " · " + esc(item.direction.replaceAll("_", " ")) : "") + `</small></article>`;
    }).join("") : `<p>No relationship has been detected yet.</p>`;
    const dependencies = active.dependencies?.length ? active.dependencies.map(item => `<li>` + esc(item) + `</li>`).join("") : "<li>None confirmed.</li>";
    const risks = active.risks?.length ? active.risks.map(item => `<li>` + esc(item) + `</li>`).join("") : "<li>None confirmed.</li>";
    return `<div class="use-case-active"><article class="card"><div class="card-head"><div><div class="eyebrow">Active use case</div><h2>` + esc(active.name) + `</h2></div><div>` + badge(active.status === "published" ? "Published" : "Draft") + ` <span class="tag">v` + Number(active.version || 1) + `</span></div></div><p>` + esc(active.description || "Description is still open.") + `</p><div class="use-case-summary"><div><span>Decision / outcome</span><strong>` + esc(active.desiredOutcome || "Unknown") + `</strong></div><div><span>AI role</span><strong>` + esc(active.aiRole || "Unknown") + `</strong></div><div><span>Human role</span><strong>` + esc(active.humanRole || "Unknown") + `</strong></div></div>` + useCaseEditor(active) + `</article><article class="card probe-panel"><div class="card-head"><div><div class="eyebrow">Context → knowledge → next question</div><h2>Dynamic probing</h2></div><span class="tag">One question at a time</span></div>` + (useCaseWorkspaceState.error ? `<div class="response-rejected"><strong>Answer needs attention</strong><p>` + esc(useCaseWorkspaceState.error) + `</p></div>` : "") + `<div class="conversation-log use-case-conversation">` + transcript + `</div>` + prompt + `</article><section class="knowledge-grid">` + useCaseKnowledgePanel("Confirmed", knowledge.confirmed, "Nothing confirmed yet.") + useCaseKnowledgePanel("Assumptions", knowledge.assumed, "No assumptions recorded.") + useCaseKnowledgePanel("Open questions", knowledge.open, "No unresolved question.") + useCaseKnowledgePanel("Conflicting", knowledge.conflicting, "No contradiction recorded.") + useCaseKnowledgePanel("Decisions", knowledge.decided, "No facilitator decision recorded.") + useCaseKnowledgePanel("Deferred", knowledge.deferred, "Nothing has been deferred.") + `</section><div class="grid use-case-evidence-grid"><article class="card"><div class="eyebrow">Dependencies</div><h2>Required capabilities and hand-offs</h2><ul>` + dependencies + `</ul></article><article class="card"><div class="eyebrow">Risks</div><h2>What could make this fail</h2><ul>` + risks + `</ul></article></div><article class="card"><div class="card-head"><div><div class="eyebrow">Related use cases</div><h2>Overlap and dependency observations</h2></div><button class="btn secondary compact" data-action="refreshUseCaseRelationships">Recheck</button></div><div class="relationship-grid">` + relationships + `</div><div class="notice"><strong>No automatic merge:</strong> relationships are suggestions until a facilitator decides.</div></article></div>`;
  })();
  return `<div class="page-head"><div><div class="eyebrow">` + esc(detail?.project?.name || "TrustBuilder AI Sales Excellence") + ` · ` + esc(detail?.module?.name || "Use-Case Discovery & Probing") + `</div><h1>Use Cases</h1><p>Build clear, evidence-ready use cases through adaptive facilitator dialogue.</p></div><span class="tag">Facilitator private</span></div><article class="card use-case-create"><div class="card-head"><div><div class="eyebrow">Add use case</div><h2>Describe the capability naturally</h2></div></div><textarea id="useCaseIntentText" placeholder="Describe the use case, or say “Add a use case for…”">` + esc(useCaseWorkspaceState.composerText) + `</textarea><div class="actions"><button class="btn secondary" data-action="detectUseCaseIntent">Use AI to recognise</button><button class="btn" data-action="createManualUseCase">Add Use Case</button></div>` + detectionPanel + `</article>` + proposalsPanel + `<div class="use-case-layout"><aside class="card use-case-list"><div class="card-head"><div><div class="eyebrow">Portfolio</div><h2>Existing use cases</h2></div><span class="tag">` + useCaseWorkspaceState.items.length + `</span></div>` + list + `</aside><section>` + activePanel + `</section></div>`;
}
function review() {
  const transcript = state.response || "I understand the urgency. Based on the service restoration, we should be fully recovered by 4pm. I’ll ask the team to confirm.";
  const evaluation = state.evaluation || analysis.evaluateResponse(transcript, state.decision || "Respond immediately");
  const score = evaluation.suggestedScore;
  const evidenceRows = evaluation.evidence.map(item => `<li class="evidence-item ${item.critical?"critical":""}"><strong>${item.dimension}</strong><span>${item.quote}</span><small>Suggested level ${item.suggestedScore} · ${item.observed?"observed":"not observed"}</small></li>`).join("");
  return `<div class="page-head"><div><div class="eyebrow">Pending human review</div><h1>Alex Morgan · Attempt ${state.attempt}</h1><p>Pressure for an immediate answer · transcription and evidence review</p></div>${badge(evaluation.criticalErrors.length?"Flagged":"Pending")}</div><div class="notice"><strong>Human sign-off required.</strong> The transcript is editable evidence; the evaluation is a suggestion and cannot publish automatically.</div><div class="grid" style="margin-top:20px"><article class="card"><div class="card-head"><div><div class="eyebrow">Verified transcript</div><h2>Review against audio</h2></div>${badge(state.transcriptStatus==="completed"?"Provider verified":"Review required")}</div>${analysis.runtime.audioUrl?`<audio controls src="${analysis.runtime.audioUrl}" style="width:100%;margin-bottom:14px"></audio>`:"<p class=\"notice\">Audio is not available after a page reload in this browser pilot. In production, the immutable recording remains in private object storage.</p>"}<div class="form-group"><label for="reviewTranscript">Transcript</label><textarea id="reviewTranscript">${esc(transcript)}</textarea></div><div class="transcript-meta"><span>${evaluation.wordCount} words</span><span>${evaluation.fillerCount} detected fillers</span><span>${state.transcriptConfidence?Math.round(state.transcriptConfidence*100)+"% recognition confidence":"Confidence unavailable"}</span></div><button class="btn secondary" data-action="verifyTranscript">Mark transcript verified</button></article><article class="card"><div class="eyebrow">Observable-evidence evaluation · ${evaluation.version}</div><h2>Judgement & Restraint</h2><p>Suggested score: <strong>${score} · ${["","Emerging","Inconsistent","Functional","Strong","Trusted-Advisor Level"][score]}</strong></p><ul class="evidence-list">${evidenceRows}</ul><div class="score-box">${[1,2,3,4,5].map(x=>`<button data-score="${x}" class="${x===score?"selected":""}">${x}</button>`).join("")}</div><div class="form-group"><label>Facilitator rationale</label><textarea id="rationale">${evaluation.criticalErrors.length?evaluation.criticalErrors.join(" "):"Confirm the observed evidence, adjust the suggested score if needed, and record why."}</textarea></div><div class="actions"><button class="btn secondary" data-action="saveReview">Save draft</button><button class="btn" data-action="approveFeedback">Approve feedback</button></div></article></div>`;
}
function adminHomeLegacy() { return `<div class="page-head"><div><div class="eyebrow">Platform health</div><h1>System overview</h1><p>Configuration and governance for the TrustBuilder pilot.</p></div></div><div class="metric-row">${metric("Active users","15","12 participants · 3 staff")}${metric("Scenario versions","18","15 library · 3 integrated")}${metric("Audit events","47","No unresolved access alerts")}</div><div class="grid"><article class="card"><h2>Safeguards</h2>${["Human approval gate","Private scenario fields","Assessment audit trail"].map(x=>`<div class="toggle"><strong>${x}</strong>${badge("Active")}</div>`).join("")}</article><article class="card"><h2>Reduced-mode readiness</h2><p>The pilot remains usable without external AI services: transcripts, scoring, observations, and feedback can be entered manually.</p><button class="btn secondary" data-route="flags">Review feature flags</button></article></div>`; }
function adminHome() {
  const active = state.users.filter(user=>user.status==="Active").length;
  const participants = state.users.filter(user=>user.status==="Active"&&user.role==="Participant").length;
  const staff = active - participants;
  return `<div class="page-head"><div><div class="eyebrow">Platform health</div><h1>System overview</h1><p>Configuration and governance for the TrustBuilder pilot.</p></div><button class="btn" data-route="users">Manage users</button></div><div class="metric-row">${metric("Active users",active,`${participants} participants · ${staff} staff`)}${metric("Responses captured",state.activity.totalResponses,`${state.activity.acceptedResponses} accepted · ${state.activity.rejectedResponses} revise`)}${metric("Audit events",47+state.activity.totalResponses,"Response and access activity included")}</div><div class="grid"><article class="card"><h2>Safeguards</h2>${["Human approval gate","Private scenario fields","Assessment audit trail"].map(x=>`<div class="toggle"><strong>${x}</strong>${badge("Active")}</div>`).join("")}</article><article class="card"><h2>Reduced-mode readiness</h2><p>The pilot remains usable without external AI services: transcripts, scoring, observations, and feedback can be entered manually.</p><button class="btn secondary" data-route="flags">Review feature flags</button></article></div>`;
}
function userManagement() {
  const form = state.showAddUser ? `<article class="card add-user-panel"><div class="card-head"><div><div class="eyebrow">Create account</div><h2>Add a new TrustBuilder user</h2></div><button class="btn secondary compact" data-action="cancelAddUser">Cancel</button></div><div class="user-form"><div class="form-group"><label for="newUserName">Full name</label><input id="newUserName" autocomplete="name" placeholder="e.g. Maya Rao"></div><div class="form-group"><label for="newUserEmail">Email</label><input id="newUserEmail" type="email" autocomplete="email" placeholder="maya.rao@example.com"></div><div class="form-group"><label for="newUserRole">Role</label><select id="newUserRole"><option>Participant</option><option>Facilitator</option><option>Administrator</option></select></div><div class="form-group"><label for="newUserCohort">Cohort</label><input id="newUserCohort" value="Cohort 01" placeholder="Cohort 01"></div></div><div class="notice"><strong>Access control:</strong> the selected role determines the workspace this user can access. Human approval and audit safeguards remain active.</div><div class="actions"><button class="btn" data-action="addUser">Add user</button></div></article>` : "";
  const rows = state.users.map(user=>`<tr><td><strong>${esc(user.name)}</strong><small class="table-subtext">${esc(user.email)}</small></td><td>${esc(user.role)}</td><td>${esc(user.cohort||"—")}</td><td>${badge(user.status||"Active")}</td></tr>`).join("");
  return `<div class="page-head"><div><div class="eyebrow">Role-based access</div><h1>User management</h1><p>${state.users.length} users in this pilot workspace.</p></div><button class="btn" data-action="showAddUser">Add user</button></div>${form}<article class="card"><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Cohort</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}
function templateManagement() {
  const template=activeTemplate();
  const validation=domain.validateTemplate(template);
  const editor=state.showTemplateEditor?`<article class="card configuration-editor"><div class="card-head"><div><div class="eyebrow">Versioned assessment rules</div><h2>${template.id?"Edit template":"Create template"}</h2></div><button class="btn secondary compact" data-action="cancelTemplateEditor">Close</button></div><div class="configuration-grid"><div class="form-group"><label for="templateName">Name</label><input id="templateName" value="${esc(template.name)}"></div><div class="form-group"><label for="templateDifficulty">Difficulty</label><select id="templateDifficulty">${["Foundation","Developing","Integrated"].map(value=>`<option ${template.difficulty===value?"selected":""}>${value}</option>`).join("")}</select></div><div class="form-group span-2"><label for="templateDescription">Description</label><input id="templateDescription" value="${esc(template.description)}"></div><div class="form-group span-2"><label for="templateObjective">Objective</label><textarea id="templateObjective">${esc(template.objective)}</textarea></div><div class="form-group"><label for="templateDos">Do’s · one per line</label><textarea id="templateDos">${esc(template.dos.join("\n"))}</textarea></div><div class="form-group"><label for="templateDonts">Don’ts · one per line</label><textarea id="templateDonts">${esc(template.donts.join("\n"))}</textarea></div></div><h3>Deterministic scoring weights</h3><div class="weight-grid">${Object.entries(template.scoringWeights).map(([key,value])=>`<label><span>${key}</span><input type="number" min="0" max="100" step="1" data-weight="${key}" value="${value}"></label>`).join("")}</div><div class="configuration-grid compact-grid"><div class="form-group"><label for="templateMinTurns">Minimum turns</label><input id="templateMinTurns" type="number" min="1" max="10" value="${template.conversationRules.minimumTurns}"></div><div class="form-group"><label for="templateMaxTurns">Maximum turns</label><input id="templateMaxTurns" type="number" min="2" max="12" value="${template.conversationRules.maxTurns}"></div></div>${validation.valid?"":`<div class="response-rejected"><strong>Template needs attention</strong><p>${esc(validation.errors.join(" "))}</p></div>`}<div class="actions"><button class="btn" data-action="saveTemplate">Save template version</button></div></article>`:"";
  return `<div class="page-head"><div><div class="eyebrow">Assessment configuration</div><h1>Template management</h1><p>Templates define observable behaviour, conversation rules, and deterministic scoring weights.</p></div><button class="btn" data-action="newTemplate">Create template</button></div>${editor}<div class="scenario-grid">${state.templates.map(item=>`<article class="card scenario-card"><div class="card-head"><span class="layer">Version ${item.version||1}</span>${badge(item.active===false?"Draft":"Active")}</div><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><div class="template-summary"><span>${item.dos.length} Do’s</span><span>${item.donts.length} Don’ts</span><span>${item.conversationRules.maxTurns} max turns</span></div><button class="btn secondary" data-template-id="${item.id}">Edit template</button></article>`).join("")}</div>`;
}
function scenarioManagement() {
  const scenario=state.generatedScenarioDraft||activeScenarioModel();
  const template=state.templates.find(item=>item.id===scenario.templateId)||activeTemplate();
  const editor=state.showScenarioEditor?`<article class="card configuration-editor"><div class="card-head"><div><div class="eyebrow">Editable before publishing</div><h2>${scenario.status==="draft"?"Scenario draft":"Edit scenario"}</h2></div><button class="btn secondary compact" data-action="cancelScenarioEditor">Close</button></div><div class="configuration-grid"><div class="form-group"><label for="scenarioTitle">Title</label><input id="scenarioTitle" value="${esc(scenario.title)}"></div><div class="form-group"><label for="scenarioTemplate">Template</label><select id="scenarioTemplate">${state.templates.map(item=>`<option value="${item.id}" ${item.id===scenario.templateId?"selected":""}>${esc(item.name)}</option>`).join("")}</select></div><div class="form-group"><label for="scenarioParticipantRole">Participant role</label><input id="scenarioParticipantRole" value="${esc(scenario.participantRole)}"></div><div class="form-group"><label for="scenarioOtherRole">Other person’s role</label><input id="scenarioOtherRole" value="${esc(scenario.otherRole)}"></div><div class="form-group span-2"><label for="scenarioContext">Initial situation</label><textarea id="scenarioContext">${esc(scenario.context)}</textarea></div><div class="form-group span-2"><label for="scenarioObjective">Objective</label><textarea id="scenarioObjective">${esc(scenario.objective)}</textarea></div><div class="form-group span-2"><label for="scenarioOpening">Opening stakeholder message</label><textarea id="scenarioOpening">${esc(scenario.openingSituation)}</textarea></div><div class="form-group"><label for="scenarioDos">Scenario Do’s · extend/override template</label><textarea id="scenarioDos">${esc((scenario.dos||[]).join("\n"))}</textarea></div><div class="form-group"><label for="scenarioDonts">Scenario Don’ts · extend/override template</label><textarea id="scenarioDonts">${esc((scenario.donts||[]).join("\n"))}</textarea></div></div><div class="notice"><strong>Template inheritance:</strong> ${esc(template.name)} rules remain active. Scenario rules extend the selected template.</div><div class="actions"><button class="btn secondary" data-action="saveScenarioDraft">Save draft</button><button class="btn" data-action="publishScenario">Publish scenario</button></div></article>`:"";
  return `<div class="page-head"><div><div class="eyebrow">Template-driven scenario engine</div><h1>Scenario management</h1><p>Create manually or generate an editable AI draft. Nothing publishes automatically.</p></div><button class="btn" data-action="newScenario">Create scenario</button></div><article class="card generator-panel"><div class="card-head"><div><div class="eyebrow">AI-assisted draft</div><h2>Generate from a focused brief</h2></div>${badge(services.runtime.health?.aiConfigured?"AI ready":"Fallback ready")}</div><div class="generator-grid"><input id="generatorTopic" placeholder="Topic · e.g. delayed release"><input id="generatorIndustry" placeholder="Industry · e.g. banking"><input id="generatorParticipantRole" placeholder="Participant role"><input id="generatorOtherRole" placeholder="Other person’s role"><input id="generatorObjective" placeholder="Assessment objective"><select id="generatorDifficulty"><option>Foundation</option><option selected>Developing</option><option>Integrated</option></select></div><div class="actions"><button class="btn secondary" data-action="generateScenario">Generate editable draft</button></div></article>${editor}<div class="scenario-grid">${state.scenarioModels.map(item=>`<article class="card scenario-card"><div class="card-head"><span class="layer">${esc(item.difficulty)}</span>${badge(item.status==="published"?"Published":"Draft")}</div><h2>${esc(item.title)}</h2><p>${esc(item.context)}</p><div class="template-summary"><span>${esc(state.templates.find(templateItem=>templateItem.id===item.templateId)?.name||"Legacy template")}</span></div><button class="btn secondary" data-scenario-id="${item.id}">Edit scenario</button></article>`).join("")}</div>`;
}
function flags() { return `<div class="page-head"><div><div class="eyebrow">Safe rollout controls</div><h1>Feature flags</h1><p>Changes persist in this demo workspace.</p></div></div><article class="card">${Object.entries(state.flags).map(([k,on])=>`<div class="toggle"><span><strong>ENABLE_${k.replace(/[A-Z]/g,m=>"_"+m).toUpperCase()}</strong><small style="display:block;color:var(--muted)">Controlled pilot capability</small></span><button class="switch ${on?"on":""}" role="switch" aria-checked="${on}" data-flag="${k}"></button></div>`).join("")}</article>`; }
function review() {
  const transcript = state.response || "No verified opening transcript is available.";
  const finalResult = state.finalEvaluation || simulation.evaluateFullInteraction({initialResponse:transcript,openingAudioRef:state.openingAudioRef,conversation:state.conversation,mode:state.mode});
  const isReviewed = state.assessmentResult?.status === "HUMAN_REVIEWED_FINAL";
  const judgement = finalResult.capabilityScores.find(item=>item.name==="Judgement & Restraint") || {score:2,evidence:"No evidence."};
  const fullConversation = state.conversation.map(turn=>`<article class="turn ${turn.role}"><div class="turn-avatar">${turn.role==="ai"?"AI":"AM"}</div><div><small>${turn.role==="ai"?"AI client":turn.accepted?"Participant · accepted":"Participant · rejected"}</small><p>${esc(turn.text)}</p></div></article>`).join("");
  return `<div class="page-head"><div><div class="eyebrow">Six-phase facilitator review</div><h1>Alex Morgan · Attempt ${state.attempt}</h1><p>${state.mode} mode · opening audio, transcript, adaptive Q&amp;A, and phase 6 evidence</p></div>${badge(isReviewed||!finalResult.status.includes("REQUIRES")?"Ready":"Pending")}</div><div class="notice"><strong>${isReviewed?"Human review completed.":"Human approval remains mandatory."}</strong> AI questions, relevance decisions, evidence, and scores are suggestions. Verify the transcript and business judgement before release.</div><div class="review-tabs"><span class="active">Complete evidence</span><span>Six capabilities</span><span>IMPACT+R</span><span>Approval history</span></div><div class="grid"><article class="card"><div class="card-head"><div><div class="eyebrow">Opening response</div><h2>Transcript verification</h2></div>${badge(state.transcriptStatus==="completed"?"Provider verified":"Review required")}</div>${analysis.runtime.audioUrl?`<audio controls src="${analysis.runtime.audioUrl}" style="width:100%;margin-bottom:14px"></audio>`:"<p class=\"notice\">The browser preview cannot retain audio after reload. Production keeps every turn as a private immutable response asset.</p>"}<div class="form-group"><label for="reviewTranscript">Editable opening transcript</label><textarea id="reviewTranscript">${esc(transcript)}</textarea></div><button class="btn secondary" data-action="verifyTranscript">Mark transcript verified and recalculate</button><h2 style="margin-top:24px">AI client conversation</h2><div class="conversation-log facilitator-log">${fullConversation||"<p>No AI conversation turns were recorded.</p>"}</div></article><article class="card"><div class="eyebrow">Phase 6 draft · ${finalResult.mode}</div><h2>Capability evidence</h2><div class="mini-score-list">${finalResult.capabilityScores.map(item=>`<div><span>${item.name}</span><strong>${item.score}</strong><small>${scoreLevel(item.score)}</small></div>`).join("")}</div><h2 style="margin-top:24px">IMPACT+R</h2><div class="impact-strip">${finalResult.impactScores.map(item=>`<span title="${esc(item.name)}"><b>${item.code}</b>${item.score}</span>`).join("")}</div><div class="form-group"><label>Final Judgement &amp; Restraint score</label><p>AI suggestion: <strong>${judgement.score} · ${scoreLevel(judgement.score)}</strong></p><p class="quote">${esc(judgement.evidence)}</p><div class="score-box">${[1,2,3,4,5].map(x=>`<button data-score="${x}" class="${x===judgement.score?"selected":""}">${x}</button>`).join("")}</div></div><div class="form-group"><label for="rationale">Facilitator rationale / override reason</label><textarea id="rationale">Confirm the capability evidence across the full conversation and record any override.</textarea></div><div class="actions"><button class="btn secondary" data-action="saveReview">Save draft</button><button class="btn" data-action="approveFeedback" ${isReviewed?"disabled":""}>${isReviewed?"Evaluation approved":"Approve evaluation and feedback"}</button></div></article></div>`;
}
function languageQualityPanel(text, question = "") {
  const scenario = scenarioRecord();
  const quality = {
    grammar: domain.evaluateGrammar(text),
    vocabulary: domain.evaluateVocabulary(text, scenario),
    repetition: domain.evaluateRepetition(text, state.conversation),
    relevance: domain.evaluateRelevance(text, question, scenario),
    clarity: domain.evaluateClarity(text)
  };
  const labels = { grammar: "Grammar", vocabulary: "Vocabulary", repetition: "Repetition", relevance: "Relevance", clarity: "Clarity" };
  const level = score => score >= 9 ? "Excellent" : score >= 7 ? "Strong" : score >= 5 ? "Functional" : score >= 3 ? "Inconsistent" : "Needs improvement";
  const evidence = item => item.evidence || item.recommendation || (item.issues?.length ? item.issues[0].issue : "No significant issue detected.");
  const suggestion = item => item.recommendation || item.missingInformation?.[0] || "Continue using precise, client-facing language.";
  const overall = Object.values(quality).reduce((total, item) => total + Number(item.score || 0), 0) / 5;
  return `<section class="card language-quality"><div class="card-head"><div><div class="eyebrow">Transcript analysis</div><h2>Language &amp; communication quality</h2></div>${tag(`Overall ${overall.toFixed(1)} / 10`)}</div><div class="quality-grid">${Object.entries(quality).map(([key,item]) => `<article><div class="quality-heading"><strong>${labels[key]}</strong><b>${Number(item.score || 0).toFixed(1)} / 10</b></div><span class="quality-level">${level(Number(item.score || 0))}</span><p>${esc(evidence(item))}</p><small>${esc(suggestion(item))}</small></article>`).join("")}</div></section>`;
}
function reviewTabbed() {
  const transcript = state.response || "No verified opening transcript is available.";
  const finalResult = state.finalEvaluation || simulation.evaluateFullInteraction({ initialResponse: transcript, openingAudioRef: state.openingAudioRef, conversation: state.conversation, mode: state.mode });
  const evaluation = state.evaluation || analysis.evaluateResponse(transcript, state.decision || "Respond immediately");
  const isReviewed = state.assessmentResult?.status === "HUMAN_REVIEWED_FINAL";
  const judgement = finalResult.capabilityScores.find(item => item.name === "Judgement & Restraint") || { score: 2, evidence: "No evidence." };
  const tab = ["evidence", "capabilities", "impact", "history"].includes(state.reviewTab) ? state.reviewTab : "evidence";
  const tabs = [["evidence", "Complete evidence"], ["capabilities", "Six capabilities"], ["impact", "IMPACT+R"], ["history", "Approval history"]];
  const fullConversation = state.conversation.map(turn => `<article class="turn ${turn.role}"><div class="turn-avatar">${turn.role === "ai" ? "AI" : "AM"}</div><div><small>${turn.role === "ai" ? "AI client" : turn.accepted ? "Participant · accepted" : "Participant · rejected"}</small><p>${esc(turn.text)}</p></div></article>`).join("");
  const evidenceSection = `<div class="grid"><article class="card"><div class="card-head"><div><div class="eyebrow">Opening response</div><h2>Transcript verification</h2></div>${badge(state.transcriptStatus === "completed" ? "Provider verified" : "Review required")}</div>${analysis.runtime.audioUrl ? `<audio controls src="${analysis.runtime.audioUrl}" style="width:100%;margin-bottom:14px"></audio>` : "<p class=\"notice\">The browser preview cannot retain audio after reload. Production keeps the original recording as a private immutable asset.</p>"}<div class="form-group"><label for="reviewTranscript">Editable opening transcript</label><textarea id="reviewTranscript">${esc(transcript)}</textarea></div><button class="btn secondary" data-action="verifyTranscript">Mark transcript verified and recalculate</button><h2 style="margin-top:24px">AI client conversation</h2><div class="conversation-log facilitator-log">${fullConversation || "<p>No AI conversation turns were recorded.</p>"}</div></article><article class="card"><div class="eyebrow">Complete evidence</div><h2>AI observations remain suggestions</h2><p>Verify the transcript, audio reference, adaptive questions, and evidence before approving the assessment.</p><ul class="evidence-list">${(evaluation.evidence || []).map(item => `<li class="evidence-item ${item.critical ? "critical" : ""}"><strong>${esc(item.dimension)}</strong><span>${esc(item.quote)}</span><small>Suggested level ${item.suggestedScore} · ${item.observed ? "observed" : "not observed"}</small></li>`).join("")}</ul></article></div>${languageQualityPanel(transcript, "")}`;
  const capabilitySection = `<article class="card"><div class="eyebrow">Phase 6 draft</div><h2>Six capability metrics</h2><div class="mini-score-list">${finalResult.capabilityScores.map(item => `<div><span>${esc(item.name)}</span><strong>${item.score}</strong><small>${scoreLevel(item.score)} · ${esc(item.evidence)}</small></div>`).join("")}</div><div class="notice" style="margin-top:18px"><strong>Evidence status:</strong> ${isReviewed ? "Human reviewed final" : "AI evaluation pending human review"}. Approval remains mandatory.</div></article>`;
  const impactAverage = finalResult.impactScores.reduce((total, item) => total + item.score, 0) / Math.max(1, finalResult.impactScores.length);
  const impactSection = `<article class="card"><div class="eyebrow">Commercial communication</div><h2>IMPACT+R · ${impactAverage.toFixed(1)} / 5 overall</h2><div class="impact-grid">${finalResult.impactScores.map(item => `<article><span>${item.code}</span><strong>${item.score}</strong><small>${esc(item.name)}</small><p>${esc(item.evidence)}</p></article>`).join("")}</div></article>`;
  const review = state.assessmentResult?.humanReview;
  const historySection = review ? `<article class="card"><div class="eyebrow">Approval history</div><h2>Human review recorded</h2><div class="table-wrap"><table><thead><tr><th>Status</th><th>Reviewer</th><th>Date/time</th><th>Previous score</th><th>Final score</th><th>Override reason</th><th>Comments</th></tr></thead><tbody><tr><td>${esc(review.status)}</td><td>${esc(review.reviewerId || "Unknown reviewer")}</td><td>${esc(review.reviewedAt || "Not recorded")}</td><td>${esc(state.assessmentResult.runningScores?.finalScore ?? "Unavailable")}</td><td>${esc(review.finalScore)}</td><td>${esc(review.overrideReason || "None")}</td><td>${esc(review.comments || "None")}</td></tr></tbody></table></div><p class="notice">Audit information is retained with the assessment result and review record.</p></article>` : `<article class="card empty"><strong>No approval history yet</strong><p>This assessment has not been approved by a facilitator.</p></article>`;
  const content = { evidence: evidenceSection, capabilities: capabilitySection, impact: impactSection, history: historySection }[tab];
  return `<div class="page-head"><div><div class="eyebrow">Six-phase facilitator review</div><h1>Alex Morgan · Attempt ${state.attempt}</h1><p>${state.mode} mode · opening audio, transcript, adaptive Q&amp;A, and phase 6 evidence</p></div>${badge(isReviewed ? "Approved" : "Pending")}</div><div class="notice"><strong>${isReviewed ? "Human review completed." : "Human approval remains mandatory."}</strong> AI questions, relevance decisions, evidence, scores, and recommendations are suggestions until a facilitator approves them.</div><div class="review-tabs" role="tablist" aria-label="Review sections">${tabs.map(([id,label]) => `<button type="button" role="tab" aria-selected="${tab === id}" aria-controls="review-panel-${id}" class="${tab === id ? "active" : ""}" data-review-tab="${id}">${label}</button>`).join("")}</div><section id="review-panel-${tab}" role="tabpanel" tabindex="0">${content}${tab === "evidence" ? `<div class="actions"><button class="btn secondary" data-action="saveReview">Save draft</button><button class="btn" data-action="approveFeedback" ${isReviewed ? "disabled" : ""}>${isReviewed ? "Evaluation approved" : "Approve evaluation and feedback"}</button></div>` : ""}</section>`;
}
function routeBody() {
  const role = currentRole();
  if (!role) {
    return `<div class="page-head"><div><div class="eyebrow">Session role unavailable</div><h1>Authentication requires a valid account role.</h1><p>Your current session does not contain an authorized role. Please log out and sign in again.</p></div></div><article class="card empty"><strong>Role mapping error</strong><p>The app will not silently fall back to Participant. Please re-authenticate with a valid account.</p></article>`;
  }
  if(role==="facilitator"&&state.route==="usecases") return useCaseWorkspace();
  if(state.route==="scenarioDetails") return scenarioDetails();
  if(state.route==="scenario") return scenario();
  if(role==="participant") return state.route==="dashboard"?participantHome():state.route==="scenarios"?scenarioList():state.route==="practice"?scenarioList(true):state.route==="profile"?profile():state.route==="language"?language():state.route==="progress"?`<div class="metric-row">${metric("Attempts","11","Across 7 scenarios")}${metric("Retry delta","+0.8","Capability change")}${metric("Reflections","100%","7 of 7")}</div>${profile()}`:reflections();
  if(role==="facilitator") return state.route==="dashboard"?facilitatorHome():state.route==="reviews"?reviewTabbed():state.route==="participants"?simpleTable("Participants","Cohort 01",["Participant","Progress","Priority","Last active"],[["Alex Morgan","7 / 9","Judgement & Restraint","Today"],["Mei Chen","8 / 9","Professional Speech","Yesterday"],["Samir Patel","6 / 9","Hypothesis Building","Today"]],"Add participant"):state.route==="library"?scenarioList(true):state.route==="reports"?simpleTable("Reports","Evidence-ready summaries",["Report","Scope","Status","Updated"],[["Individual · Alex Morgan","Baseline to current","Ready","24 Aug"],["Facilitator · Cohort 01","12 participants","Ready","25 Aug"],["Leadership summary","August pilot","Draft","25 Aug"]],"Generate report"):simpleTable(state.route[0].toUpperCase()+state.route.slice(1),"Facilitator workspace",["Item","Status","Owner"],[["Cohort 01","Active","Priya Shah"],["Foundation set","Published","Priya Shah"],["Integrated rubric v1.2","Current","Jordan Lee"]]);
  if(role==="administrator"&&state.route==="users") return userManagement();
  if(role==="administrator"&&state.route==="templates") return templateManagement();
  if(role==="administrator"&&state.route==="library") return scenarioManagement();
  return state.route==="dashboard"?adminHome():state.route==="flags"?flags():state.route==="users"?simpleTable("User management","Role-based access",["User","Role","Cohort","Status"],[["Alex Morgan","Participant","Cohort 01","Active"],["Priya Shah","Facilitator","Cohort 01","Active"],["Jordan Lee","Administrator","—","Active"]],"Add user"):state.route==="audit"?simpleTable("Audit log","Governance and traceability",["Time","Actor","Action","Record"],[["14:41","Priya Shah","Feedback approved","Attempt AT-1042"],["14:38","Priya Shah","AI score overridden 3 → 2","Assessment AS-882"],["13:05","Jordan Lee","Feature flag updated","AI_TRANSCRIPTION"]],"Export audit"):simpleTable(state.route==="ai"?"AI settings":state.route[0].toUpperCase()+state.route.slice(1),"Administration",["Configuration","Version","Status"],[["Capability rubrics","v1.2","Published"],["Scenario library","18 versions","Active"],["Mock AI adapter","v1","Available"]]);
}
function addInlineResponseControls() {
  if(state.stage==="response"||state.stage==="retry") {
    const saveButton = document.querySelector('[data-action="saveDraft"]');
    if(saveButton) saveButton.insertAdjacentHTML("beforebegin", '<button class="btn ghost-danger" data-action="clearResponse">Clear response</button>');
  }
  if(state.stage==="conversation") {
    const context = simulation.getAssistantContext({mode:state.mode,scenario:currentScenarioForPractice(),conversation:state.conversation});
    const conversationHead = document.querySelector(".conversation-head");
    if(conversationHead) conversationHead.insertAdjacentHTML("afterend", `<div class="assistant-scope"><div><span>Project</span><strong>${esc(context.project)}</strong></div><i>›</i><div><span>Module</span><strong>${esc(context.module)}</strong></div><i>›</i><div><span>Task</span><strong>${esc(context.currentTask)}</strong></div><button class="btn secondary compact" data-action="restartConversation">Restart focused session</button><small>${esc(context.moduleMotto)}</small></div>`);
    const [statusLabel,statusDetail]=responseStatusLabel();
    document.querySelector(".assistant-scope")?.insertAdjacentHTML("afterend",`<div class="conversation-status ${state.conversationStatus}"><span class="thinking-dot"></span><div><strong>${statusLabel}</strong><small>${statusDetail}</small></div></div>`);
    const submitButton = document.querySelector('[data-action="submitConversationAnswer"]');
    if(submitButton) {submitButton.insertAdjacentHTML("beforebegin", '<button class="btn ghost-danger" data-action="clearConversationAnswer">Clear answer</button>');submitButton.disabled=conversationRequestInFlight||["evaluating","ai_turn"].includes(state.conversationStatus);submitButton.textContent=submitButton.disabled?"Processing response…":"Submit relevant answer";}
  }
}
function addAssessmentResultPanels() {
  const result=state.assessmentResult;if(!result)return;
  const scoreItems=Object.entries(result.runningScores?.rawScores||{}).map(([key,value])=>`<div><span>${esc(key)}</span><strong>${Number(value).toFixed(1)}</strong></div>`).join("");
  const dos=(result.dosPerformance||[]).map(item=>`<li><strong>${esc(item.criterion)}</strong><span>${esc(item.status.replaceAll("_"," "))}</span><small>${esc(item.evidence)}</small></li>`).join("")||"<li>No demonstrated criteria yet.</li>";
  const donts=(result.dontViolations||[]).map(item=>`<li><strong>${esc(item.criterion)}</strong><span>${esc(item.severity)}</span><small>${esc(item.evidence)}</small></li>`).join("")||"<li>No supported Don’t violations detected.</li>";
  const comparison=state.retryComparison?`<div class="retry-comparison"><h3>Attempt ${Math.max(1,state.attempt-1)} → Attempt ${state.attempt}</h3><div class="comparison-grid">${Object.entries(state.retryComparison.scoreDelta).map(([key,value])=>`<div><span>${esc(key)}</span><strong class="${value>=0?"positive":"negative"}">${value>=0?"+":""}${value.toFixed(1)}</strong></div>`).join("")}</div><p><strong>Fixed:</strong> ${esc(state.retryComparison.fixedIssues.join(", ")||"No previous violation resolved yet.")}</p><p><strong>Still present:</strong> ${esc(state.retryComparison.issuesStillPresent.join(", ")||"None")}</p><p><strong>New:</strong> ${esc(state.retryComparison.newIssues.join(", ")||"None")}</p></div>`:"";
  const panel=`<article class="card deterministic-result"><div class="card-head"><div><div class="eyebrow">Deterministic template score</div><h2>${result.runningScores.finalScore}/100 · ${esc(result.overallPerformance)}</h2></div>${badge(result.status==="HUMAN_REVIEWED_FINAL"?"Human reviewed":"AI evaluation")}</div><div class="criterion-strip">${scoreItems}</div><div class="result-columns"><section><h3>Do’s performance</h3><ul class="criterion-evidence">${dos}</ul></section><section><h3>Don’t violations</h3><ul class="criterion-evidence">${donts}</ul></section></div>${comparison}<div class="notice"><strong>Approval boundary:</strong> this calculated score and AI evidence remain separate from the facilitator’s final reviewed score.</div></article>`;
  if(state.stage==="finalEvaluation")document.querySelector(".workspace")?.insertAdjacentHTML("afterend",panel);
  if(role==="facilitator"&&state.route==="reviews")document.querySelector(".page-head")?.insertAdjacentHTML("afterend",panel);
}
function render() {
  if (!auth.user) return renderAuth();
  window.TRUSTBUILDER_AUTH_USER = auth.user;
  window.TRUSTBUILDER_CURRENT_ROLE = currentRole();
  document.querySelector("#app").innerHTML=shell(routeBody());
  addInlineResponseControls();
  addAssessmentResultPanels();
  document.querySelectorAll("[data-route]").forEach(b=>b.onclick=()=>{state.route=b.dataset.route;save();render()});
  document.querySelectorAll("[data-stage]").forEach(b=>b.onclick=()=>{state.stage=b.dataset.stage;save();render()});
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;save();render()});
  document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>action(b.dataset.action, b));
  document.querySelectorAll("[data-review-tab]").forEach(button=>button.onclick=()=>{state.reviewTab=button.dataset.reviewTab;save();render();document.querySelector(`[data-review-tab="${state.reviewTab}"]`)?.focus()});
  document.querySelectorAll("[data-review-tab]").forEach(button=>button.onkeydown=event=>{if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;event.preventDefault();const tabs=[...document.querySelectorAll("[data-review-tab]")];const index=tabs.indexOf(button);const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click()});
  document.querySelectorAll("[data-template-id]").forEach(b=>b.onclick=()=>{state.selectedTemplateId=b.dataset.templateId;state.showTemplateEditor=true;save();render()});
  document.querySelectorAll("[data-scenario-id]").forEach(b=>b.onclick=()=>{state.selectedScenarioId=b.dataset.scenarioId;state.generatedScenarioDraft=null;state.showScenarioEditor=true;save();render()});
  document.querySelectorAll("[data-use-case-id]").forEach(button=>button.onclick=()=>loadUseCaseDetail(button.dataset.useCaseId));
  document.querySelectorAll("[data-score]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-score]").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");toast(`Final score set to ${b.dataset.score}; approval still required.`)});
  document.querySelectorAll("[data-flag]").forEach(b=>b.onclick=()=>{state.flags[b.dataset.flag]=!state.flags[b.dataset.flag];save();render();toast("Feature flag updated.")});
}
function upsertUseCaseItem(record) {
  const index = useCaseWorkspaceState.items.findIndex(item => item.id === record.id);
  if (index >= 0) useCaseWorkspaceState.items[index] = { ...useCaseWorkspaceState.items[index], ...record };
  else useCaseWorkspaceState.items.unshift(record);
}
async function loadUseCaseDetail(useCaseId) {
  if (!useCaseId || !["facilitator", "administrator"].includes(auth.user?.role)) return;
  useCaseWorkspaceState.selectedId = useCaseId;
  useCaseWorkspaceState.error = "";
  try {
    useCaseWorkspaceState.detail = await services.getUseCase(useCaseId);
    upsertUseCaseItem(useCaseWorkspaceState.detail.useCase);
  } catch (error) {
    useCaseWorkspaceState.error = error.message;
  }
  render();
}
function useCaseArrayInput(id) { return (document.querySelector("#" + id)?.value || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean); }
function useCasePatchFromForm(record) {
  const value = id => document.querySelector("#" + id)?.value.trim() ?? record[id];
  return {
    expectedVersion: record.version,
    name: value("useCaseName"),
    description: value("useCaseDescription"),
    objective: value("useCaseObjective"),
    businessProblem: value("useCaseBusinessProblem"),
    desiredOutcome: value("useCaseDesiredOutcome"),
    trigger: value("useCaseTrigger"),
    currentProcess: value("useCaseCurrentProcess"),
    aiRole: value("useCaseAiRole"),
    humanRole: value("useCaseHumanRole"),
    targetUsers: useCaseArrayInput("useCaseTargetUsers"),
    stakeholders: useCaseArrayInput("useCaseStakeholders"),
    inputs: useCaseArrayInput("useCaseInputs"),
    outputs: useCaseArrayInput("useCaseOutputs"),
    dataSources: useCaseArrayInput("useCaseDataSources"),
    systems: useCaseArrayInput("useCaseSystems"),
    dependencies: useCaseArrayInput("useCaseDependencies"),
    constraints: useCaseArrayInput("useCaseConstraints"),
    assumptions: useCaseArrayInput("useCaseAssumptions"),
    risks: useCaseArrayInput("useCaseRisks"),
    successCriteria: useCaseArrayInput("useCaseSuccessCriteria"),
    kpis: useCaseArrayInput("useCaseKpis"),
    edgeCases: useCaseArrayInput("useCaseEdgeCases"),
    confirmedFacts: useCaseArrayInput("useCaseConfirmedFacts"),
    openQuestions: useCaseArrayInput("useCaseOpenQuestions"),
    decisions: useCaseArrayInput("useCaseDecisions")
  };
}
async function hydrateServerContent(force=false) {
  if(!force&&hydratedRole===state.role)return;
  const roleAtStart=state.role;
  try{
    const health=await services.health(force);if(!health.ok)return;
    const scenarios=await services.listScenarios();if(roleAtStart!==state.role)return;
    if(Array.isArray(scenarios.scenarios)&&scenarios.scenarios.length)state.scenarioModels=scenarios.scenarios;
    if(["administrator","facilitator"].includes(roleAtStart)){const templates=await services.listTemplates();if(Array.isArray(templates.templates)&&templates.templates.length)state.templates=templates.templates;}
    if(roleAtStart==="facilitator"&&["facilitator","administrator"].includes(auth.user?.role)){
      const useCases=await services.listUseCases();
      if(Array.isArray(useCases.useCases))useCaseWorkspaceState.items=useCases.useCases;
      useCaseWorkspaceState.proposals=Array.isArray(useCases.proposals)?useCases.proposals:[];
      useCaseWorkspaceState.hydrated=true;
      if(!useCaseWorkspaceState.selectedId&&useCaseWorkspaceState.items.length)useCaseWorkspaceState.selectedId=useCaseWorkspaceState.items[0].id;
      if(useCaseWorkspaceState.selectedId)useCaseWorkspaceState.detail=await services.getUseCase(useCaseWorkspaceState.selectedId);
    }
    if(roleAtStart==="administrator"){const users=await services.listUsers();if(Array.isArray(users.users))state.users=users.users.map(item=>({...item,role:item.role[0].toUpperCase()+item.role.slice(1),status:item.status[0].toUpperCase()+item.status.slice(1)}));}
    hydratedRole=roleAtStart;save();render();
  }catch(error){hydratedRole=roleAtStart}
}
async function startAssessmentConversation() {
  state.conversation=[];state.conversationAnswer="";state.conversationError="";state.conversationSession=null;state.currentTurnEvaluation=null;state.assessmentResult=null;state.finalEvaluation=null;state.conversationStatus="ai_turn";analysis.runtime.captureMeta=null;state.stage="conversation";save();render();
  let question="";
  try {
    const health=await services.health(true);if(!health.ok)throw new Error("Session service unavailable");
    const result=await services.startConversation({scenarioId:activeScenarioModel().id,scenario:scenarioRecord(),templateId:activeTemplate().id,participantId:auth.user?.id,attemptNumber:state.attempt,mode:state.mode});
    syncConversationSession(result.session);question=result.aiMessage.message;
  } catch(error) {
    const next=await simulation.nextQuestion({mode:state.mode,scenario:activeScenarioModel(),conversation:state.conversation,initialEvaluation:state.evaluation});
    state.conversation.push({role:"ai",text:next.question,phase:next.phase,rationaleCode:next.rationaleCode,createdAt:new Date().toISOString()});state.conversationStatus="waiting_for_user";question=next.question;
  }
  save();render();await speakAI(question);
}
async function completeLegacyEvaluation() {
  state.finalEvaluation=await simulation.finalEvaluation({initialResponse:state.response,openingAudioRef:state.openingAudioRef,conversation:state.conversation,mode:state.mode,scenario:activeScenarioModel(),existingScoringMethodology:"five-level capability rubric plus IMPACT+R"});state.stage="finalEvaluation";state.conversationStatus="completed";save();render();
}
async function submitLocalConversationAnswer(answer) {
  const currentQuestion=[...state.conversation].reverse().find(turn=>turn.role==="ai")?.text||"";
  const validation=await simulation.validateAnswerWithProvider({answer,question:currentQuestion,context:{mode:state.mode,scenario:activeScenarioModel(),previousAnswers:state.conversation.filter(t=>t.role==="participant")}});
  const audioRef=analysis.runtime.captureMeta;const answerPhase=state.conversation.filter(t=>t.role==="participant"&&t.accepted).length<2?4:5;
  state.conversation.push({role:"participant",text:answer,accepted:validation.relevant,validation,audioRef,phase:answerPhase,createdAt:new Date().toISOString()});recordResponseActivity(`Phase ${answerPhase} AI answer`,answer||"Empty answer",validation.relevant);analysis.runtime.captureMeta=null;
  if(!validation.relevant){state.conversationAnswer=answer;state.conversationError=validation.message;state.conversationStatus="waiting_for_user";save();render();toast("Response needs revision. Dashboard updated.");await simulation.speak(validation.message,()=>{});return}
  state.conversationAnswer="";state.conversationError="";const next=await simulation.nextQuestion({mode:state.mode,scenario:activeScenarioModel(),conversation:state.conversation,initialEvaluation:state.evaluation});
  if(next.complete){await completeLegacyEvaluation();toast("Response accepted. Dashboard and phase 6 evidence updated.");return}
  state.conversation.push({role:"ai",text:next.question,phase:next.phase,rationaleCode:next.rationaleCode,createdAt:new Date().toISOString()});state.conversationStatus="waiting_for_user";save();render();toast("Response accepted. Dashboard updated.");await speakAI(next.question);
}
async function submitAssessmentResponse(answer) {
  if(conversationRequestInFlight)return toast("Your previous response is still processing.");
  if(!answer.trim())return toast("Provide a response before submitting.");
  conversationRequestInFlight=true;state.conversationStatus="evaluating";state.conversationAnswer=answer;save();render();
  try {
    const health=await services.health();
    if(!health.ok||!state.conversationSession?.id){await submitLocalConversationAnswer(answer);return}
    const idempotencyKey=services.id(`turn-${state.conversationSession.turnNumber+1}`);
    const result=await services.respond({sessionId:state.conversationSession.id,originalResponse:answer,transcription:analysis.runtime.captureMeta?.transcript||null,audioReference:analysis.runtime.captureMeta||null,inputType:analysis.runtime.captureMeta?"voice":"text",idempotencyKey,expectedRevision:state.conversationSession.revision});
    state.currentTurnEvaluation=result.evaluation;state.conversationAnswer="";state.conversationError="";analysis.runtime.captureMeta=null;syncConversationSession(result.session);
    const accepted=result.evaluation.relevance.classification!=="irrelevant";recordResponseActivity(`Turn ${result.evaluation.turnNumber} assessed response`,answer,accepted);
    if(!accepted)state.conversationError=result.evaluation.relevance.missingInformation?.[0]||"Address the stakeholder’s current question directly.";
    if(result.assessmentResult){state.assessmentResult=result.assessmentResult;const previous=state.attemptHistory.at(-1);if(previous)state.retryComparison=domain.compareAttempts(previous,result.session);await completeLegacyEvaluation();toast("Assessment completed. Evidence and deterministic scores are ready for human review.");return}
    save();render();toast(`${accepted?"Response evaluated":"Response redirected"}. Dashboard updated.`);if(result.aiMessage?.message)void speakAI(result.aiMessage.message);
  } catch(error) {
    toast("The assessment service was unavailable, so the safe local workflow continued.");await submitLocalConversationAnswer(answer);
  } finally {
    conversationRequestInFlight=false;if(state.stage==="conversation"){save();render()}
  }
}
async function createUseCaseDraftAndProbe(candidate) {
  useCaseProbeInFlight = true;
  useCaseWorkspaceState.error = "";
  render();
  try {
    const created = await services.createUseCase(candidate);
    upsertUseCaseItem(created.useCase);
    useCaseWorkspaceState.selectedId = created.useCase.id;
    useCaseWorkspaceState.detail = created;
    useCaseWorkspaceState.detection = null;
    useCaseWorkspaceState.composerText = "";
    useCaseWorkspaceState.answerText = "";
    const probed = await services.probeUseCase(created.useCase.id, "");
    useCaseWorkspaceState.detail = probed;
    upsertUseCaseItem(probed.useCase);
    toast("Draft created. The highest-value question is ready.");
  } catch (error) {
    useCaseWorkspaceState.error = error.message;
    toast(error.message || "The use-case draft could not be created.");
  } finally {
    useCaseProbeInFlight = false;
    render();
  }
}
async function action(name, source = null) {
  if(name==="openScenario"){const activeScenario=currentScenarioForPractice();if(activeScenario) state.selectedScenarioId=activeScenario.id;loadCurrentDraft();state.route="scenario";state.stage=state.approved?"feedback":"briefing";save();render()}
  else if(name==="logout"){await logout()}
  else if(name==="openScenarioDetails"){state.selectedScenarioId=source?.dataset.scenario||state.selectedScenarioId;state.route="scenarioDetails";save();render()}
  else if(name==="startSelectedScenario"){loadCurrentDraft();state.route="scenario";state.stage=state.approved?"feedback":"briefing";save();render()}
  else if(name==="exportNotes"){
    const rows=[
      ["Alex Morgan","The Silent Escalation","Asked who was affected before proposing action.","Separated stakeholder impact from the immediate recommendation.","2024-08-24","Active Listening","3.8","Name the evidence needed before committing."],
      ["Alex Morgan","Changing scope","Named the trade-off before accepting urgency.","Explained the delivery consequence and agreed a boundary.","2024-08-16","Judgement & Restraint","3.6","Set a precise checkpoint for the next decision."]
    ];
    if(!downloadCsv("trustbuilder-notes-alex-morgan.csv",["Participant","Scenario","Reflection","What changed","Completion date","Relevant capability","Current score","Development recommendation"],rows))return toast("There are no reflection notes to export.");
    toast("Reflection notes download started.");
  }
  else if(name==="exportAudit"){
    const rows=[["14:41","Priya Shah","Feedback approved","Attempt AT-1042"],["14:38","Priya Shah","AI score overridden 3 -> 2","Assessment AS-882"],["13:05","Jordan Lee","Feature flag updated","AI_TRANSCRIPTION"]];
    downloadCsv("trustbuilder-audit-log.csv",["Time","Actor","Action","Record"],rows);toast("Audit export download started.");
  }
  else if(name==="reviewTab"){state.reviewTab=document.querySelector("[data-review-tab].active")?.dataset.reviewTab||"evidence";save();render()}
  else if(name==="saveDraft"){capture();state.responseDrafts[currentDraftKey()]={response:state.response,justification:state.justification,decision:state.decision,transcriptStatus:state.transcriptStatus,transcriptConfidence:state.transcriptConfidence,savedAt:new Date().toISOString()};save();toast("Draft saved.")}
  else if(name==="clearResponse"){
    analysis.clearCapture();
    state.openingAudioRef=null;
    delete state.responseDrafts[currentDraftKey()];
    state.response="";state.justification="";state.decision="";state.transcriptStatus="not-started";state.transcriptConfidence=null;state.evaluation=null;save();render();toast("Response cleared.");
  }
  else if(name==="clearConversationAnswer"){
    if(analysis.runtime.recorder?.state==="recording") return toast("Stop the recording before clearing the answer.");
    state.conversationAnswer="";state.conversationError="";save();render();toast("Current answer cleared. Previous conversation turns are unchanged.");
  }
  else if(name==="detectUseCaseIntent"){
    const text=document.querySelector("#useCaseIntentText")?.value.trim()||"";
    if(!text)return toast("Describe the new use case first.");
    useCaseWorkspaceState.composerText=text;useCaseWorkspaceState.error="";
    try{useCaseWorkspaceState.detection=await services.detectUseCase(text);render();if(useCaseWorkspaceState.detection.detected)toast("New use-case intent recognised. Confirm the draft to continue.");else toast("No explicit add-use-case intent found. You can create a manual draft.");}
    catch(error){useCaseWorkspaceState.error=error.message;render();toast(error.message)}
  }
  else if(name==="createManualUseCase"){
    const text=document.querySelector("#useCaseIntentText")?.value.trim()||useCaseWorkspaceState.composerText;
    if(!text)return toast("Enter a use-case name or description first.");
    useCaseWorkspaceState.composerText=text;
    const detected=domain.detectNewUseCaseIntent(text);
    const cleanName=text.replace(/^(?:add|create|new)\s+(?:another\s+|a\s+|an\s+)?use[\s-]?case(?:\s+(?:for|around|called|named))?\s*[:\-]?\s*/i,"").replace(/[.!?]+$/,"").trim();
    await createUseCaseDraftAndProbe(detected.candidate||{name:cleanName||text,description:text});
  }
  else if(name==="createDetectedUseCase"){
    if(!useCaseWorkspaceState.detection?.candidate)return toast("Recognise a new use case first.");
    await createUseCaseDraftAndProbe(useCaseWorkspaceState.detection.candidate);
  }
  else if(name==="acceptUseCaseProposal"){
    const proposal = useCaseWorkspaceState.proposals.find(item => item.id === source?.dataset.proposalId);
    if(!proposal) return toast("Select a proposal first.");
    await createUseCaseDraftAndProbe({ name: proposal.name, description: proposal.description, objective: proposal.rationale, businessProblem: proposal.rationale });
  }
  else if(name==="saveUseCaseDraft"||name==="publishUseCase"){
    const current=useCaseWorkspaceState.detail?.useCase;if(!current)return toast("Select a use case first.");
    const patch=useCasePatchFromForm(current);if(name==="publishUseCase")patch.status="published";
    try{
      const updated=await services.updateUseCase(current.id,patch);
      useCaseWorkspaceState.detail=updated;upsertUseCaseItem(updated.useCase);render();
      toast(name==="publishUseCase"?"Use case published by facilitator.":"Draft saved and version incremented.");
    }catch(error){useCaseWorkspaceState.error=error.message;render();toast(error.message)}
  }
  else if(name==="startUseCaseProbe"||name==="submitUseCaseProbe"){
    const current=useCaseWorkspaceState.detail?.useCase;if(!current)return toast("Select a use case first.");
    const answer=name==="submitUseCaseProbe"?(document.querySelector("#useCaseProbeAnswer")?.value.trim()||""):"";
    if(name==="submitUseCaseProbe"&&!answer)return toast("Add a relevant answer before continuing.");
    useCaseWorkspaceState.answerText=answer;useCaseWorkspaceState.error="";useCaseProbeInFlight=true;render();
    try{
      const result=await services.probeUseCase(current.id,answer);
      useCaseWorkspaceState.detail=result;upsertUseCaseItem(result.useCase);
      if(result.accepted===false){useCaseWorkspaceState.error=result.validationMessage||"Make the answer specific to the current question.";}
      else{useCaseWorkspaceState.answerText="";}
      render();toast(result.accepted===false?"The answer needs clarification.":"Knowledge state updated. A new high-value question is ready.");
    }catch(error){useCaseWorkspaceState.error=error.message;render();toast(error.message)}
    finally{useCaseProbeInFlight=false;render()}
  }
  else if(name==="refreshUseCaseRelationships"){
    const current=useCaseWorkspaceState.detail?.useCase;if(!current)return;
    try{const result=await services.analyzeUseCaseRelationships({useCaseId:current.id});useCaseWorkspaceState.detail={...useCaseWorkspaceState.detail,relationships:result.relationships};render();toast("Relationship analysis refreshed.");}
    catch(error){toast(error.message)}
  }
  else if(name==="showAddUser"){state.showAddUser=true;save();render();setTimeout(()=>document.querySelector("#newUserName")?.focus(),0)}
  else if(name==="cancelAddUser"){state.showAddUser=false;save();render()}
  else if(name==="addUser"){
    const nameValue=document.querySelector("#newUserName")?.value.trim()||"";
    const email=document.querySelector("#newUserEmail")?.value.trim().toLowerCase()||"";
    const role=document.querySelector("#newUserRole")?.value||"Participant";
    const cohortInput=document.querySelector("#newUserCohort")?.value.trim()||"";
    if(nameValue.length<2)return toast("Enter the new user’s full name.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast("Enter a valid email address.");
    if(state.users.some(user=>user.email.toLowerCase()===email))return toast("A user with this email already exists.");
    let newUser={id:crypto.randomUUID?.()||`usr-${Date.now()}`,name:nameValue,email,role,cohort:role==="Administrator"?"—":cohortInput||"Cohort 01",status:"Active",createdAt:new Date().toISOString()};
    try{const result=await services.createUser(newUser);newUser={...result.user,role:result.user.role[0].toUpperCase()+result.user.role.slice(1),status:result.user.status[0].toUpperCase()+result.user.status.slice(1)}}catch(error){if(error.code==="USER_EMAIL_EXISTS")return toast(error.message);toast("User saved locally; the server will receive the account when available.")}
    state.users.push(newUser);
    state.showAddUser=false;save();render();toast(`${nameValue} was added as ${role}.`);
  }
  else if(name==="newTemplate"){
    const draft={...domain.clone(domain.DEFAULT_TEMPLATE),id:domain.createId("template"),name:"Untitled assessment template",description:"",active:false,version:0};state.templates.push(draft);state.selectedTemplateId=draft.id;state.showTemplateEditor=true;save();render();
  }
  else if(name==="cancelTemplateEditor"){state.showTemplateEditor=false;save();render()}
  else if(name==="saveTemplate"){
    const current=activeTemplate();const weights=Object.fromEntries([...document.querySelectorAll("[data-weight]")].map(input=>[input.dataset.weight,Number(input.value)]));
    const candidate={...current,name:document.querySelector("#templateName")?.value.trim(),description:document.querySelector("#templateDescription")?.value.trim(),objective:document.querySelector("#templateObjective")?.value.trim(),difficulty:document.querySelector("#templateDifficulty")?.value,dos:(document.querySelector("#templateDos")?.value||"").split("\n").map(x=>x.trim()).filter(Boolean),donts:(document.querySelector("#templateDonts")?.value||"").split("\n").map(x=>x.trim()).filter(Boolean),scoringWeights:weights,conversationRules:{...current.conversationRules,minimumTurns:Number(document.querySelector("#templateMinTurns")?.value||3),maxTurns:Number(document.querySelector("#templateMaxTurns")?.value||6)},active:true};
    const validation=domain.validateTemplate(candidate);if(!validation.valid)return toast(validation.errors[0]);
    let savedTemplate={...validation.value,version:Number(current.version||0)+1,updatedAt:new Date().toISOString()};
    try{const server=await services.saveTemplate(candidate);savedTemplate=server.template}catch(error){toast("Saved locally; the server will receive this template when available.")}
    const index=state.templates.findIndex(item=>item.id===savedTemplate.id);if(index>=0)state.templates[index]=savedTemplate;else state.templates.push(savedTemplate);state.selectedTemplateId=savedTemplate.id;state.showTemplateEditor=false;save();render();toast("Template version saved.");
  }
  else if(name==="newScenario"){
    const draft={...domain.clone(domain.DEFAULT_SCENARIO),id:domain.createId("scenario"),templateId:activeTemplate().id,title:"Untitled scenario",status:"draft",active:false,version:0};state.scenarioModels.push(draft);state.selectedScenarioId=draft.id;state.generatedScenarioDraft=null;state.showScenarioEditor=true;save();render();
  }
  else if(name==="cancelScenarioEditor"){state.showScenarioEditor=false;state.generatedScenarioDraft=null;save();render()}
  else if(name==="generateScenario"){
    const request={topic:document.querySelector("#generatorTopic")?.value.trim(),industry:document.querySelector("#generatorIndustry")?.value.trim(),participantRole:document.querySelector("#generatorParticipantRole")?.value.trim(),otherRole:document.querySelector("#generatorOtherRole")?.value.trim(),objective:document.querySelector("#generatorObjective")?.value.trim(),difficulty:document.querySelector("#generatorDifficulty")?.value,templateId:activeTemplate().id};if(!request.topic)return toast("Add a scenario topic first.");
    const button=document.querySelector('[data-action="generateScenario"]');if(button){button.disabled=true;button.textContent="Generating draft…"}
    try{const result=await services.generateScenario(request);state.generatedScenarioDraft=result.scenario;state.selectedScenarioId=result.scenario.id;state.showScenarioEditor=true;save();render();toast("Editable scenario draft generated. Review it before publishing.")}catch(error){toast(error.message||"Scenario generation is unavailable. Create the scenario manually.");render()}
  }
  else if(name==="saveScenarioDraft"||name==="publishScenario"){
    const current=state.generatedScenarioDraft||activeScenarioModel();const candidate={...current,title:document.querySelector("#scenarioTitle")?.value.trim(),templateId:document.querySelector("#scenarioTemplate")?.value,participantRole:document.querySelector("#scenarioParticipantRole")?.value.trim(),otherRole:document.querySelector("#scenarioOtherRole")?.value.trim(),context:document.querySelector("#scenarioContext")?.value.trim(),objective:document.querySelector("#scenarioObjective")?.value.trim(),openingSituation:document.querySelector("#scenarioOpening")?.value.trim(),dos:(document.querySelector("#scenarioDos")?.value||"").split("\n").map(x=>x.trim()).filter(Boolean),donts:(document.querySelector("#scenarioDonts")?.value||"").split("\n").map(x=>x.trim()).filter(Boolean),status:name==="publishScenario"?"published":"draft",active:name==="publishScenario"};if(!candidate.title||!candidate.objective||!candidate.openingSituation)return toast("Title, objective, and opening message are required.");
    let savedScenario={...domain.resolveScenario(candidate,state.templates.find(item=>item.id===candidate.templateId)||activeTemplate()).scenario,version:Number(current.version||0)+1,updatedAt:new Date().toISOString()};
    try{const server=await services.saveScenario(candidate);savedScenario=server.scenario}catch(error){toast("Saved locally; the server will receive this scenario when available.")}
    const index=state.scenarioModels.findIndex(item=>item.id===savedScenario.id);if(index>=0)state.scenarioModels[index]=savedScenario;else state.scenarioModels.push(savedScenario);state.selectedScenarioId=savedScenario.id;state.generatedScenarioDraft=null;state.showScenarioEditor=false;save();render();toast(name==="publishScenario"?"Scenario published.":"Scenario draft saved.");
  }
  else if(name==="submitResponse"){capture();if(!state.decision||(!state.response.trim()&&!analysis.runtime.audioBlob))return toast("Choose an action and provide a response.");state.evaluation=analysis.evaluateResponse(state.response,state.decision);recordResponseActivity(state.stage==="retry"?"Retry response":"Opening response",state.response||"Audio response captured",true);state.stage=state.stage==="retry"?"reflection":"evidence";if(state.stage==="reflection")state.attempt++;save();render();toast("Response recorded. Dashboard updated.")}
  else if(name==="record"){try{const btn=document.querySelector('[data-action="record"]');const status=document.querySelector("#recordStatus"),detail=document.querySelector("#recordDetail");if(analysis.runtime.recorder?.state!=="recording"){await analysis.startCapture({onTranscript:(finalText,interim)=>{const field=document.querySelector("#responseText"),live=document.querySelector("#interimTranscript");if(finalText)field.value=finalText;live.textContent=interim?`Live draft: ${interim}`:"";live.classList.toggle("hidden",!interim)},onStatus:(s,m)=>{state.transcriptStatus=s;status.textContent=s==="recording"?"Recording in progress":"Transcription needs review";detail.textContent=m}});btn.textContent="Stop and review"}else{btn.disabled=true;status.textContent="Processing audio";const result=await analysis.stopCapture({onStatus:(s,m)=>{state.transcriptStatus=s;detail.textContent=m}});if(result?.transcript){state.response=result.transcript;document.querySelector("#responseText").value=result.transcript}state.transcriptConfidence=result?.confidence||null;document.querySelector("#audioReview").innerHTML=result?.url?`<audio controls src="${result.url}" style="width:100%;margin-top:12px"></audio>`:"";btn.textContent="Recording captured";status.textContent="Draft transcript ready for review";save();try{const provider=await analysis.transcribeWithProvider({scenario:"Pressure for an immediate answer",languageHints:["English"],keywordHints:["reconciliation","downstream validation","recovery"]});if(provider?.text){state.response=provider.text;state.transcriptStatus="completed";state.transcriptConfidence=provider.confidence??state.transcriptConfidence;document.querySelector("#responseText").value=provider.text;status.textContent="High-accuracy transcript ready";detail.textContent="Provider transcript received; verify names, numbers, and commitments.";save()}}catch(error){state.transcriptStatus="partial";detail.textContent="High-accuracy transcription was unavailable. The audio and editable draft are preserved.";save();toast(error.message)}}}catch(error){state.transcriptStatus="failed";save();toast(`${error.message} Continue with a written response.`)}}
  else if(name==="startConversation")await startAssessmentConversation()
  else if(name==="submitConversationAnswer")await submitAssessmentResponse(document.querySelector("#conversationAnswer")?.value.trim()||"")
  else if(name==="recordConversation"){try{const btn=document.querySelector('[data-action="recordConversation"]'),status=document.querySelector("#conversationRecordStatus"),detail=document.querySelector("#conversationRecordDetail");if(analysis.runtime.recorder?.state!=="recording"){await analysis.startCapture({onTranscript:(finalText,interim)=>{const field=document.querySelector("#conversationAnswer"),live=document.querySelector("#conversationInterim");if(finalText)field.value=finalText;live.textContent=interim?`Live draft: ${interim}`:""},onStatus:(s,m)=>{status.textContent=s==="recording"?"Recording in progress":"Transcript needs review";detail.textContent=m}});btn.textContent="Stop and review"}else{btn.disabled=true;const result=await analysis.stopCapture({onStatus:(s,m)=>{detail.textContent=m}});state.conversationAnswer=result?.transcript||document.querySelector("#conversationAnswer").value||"";state.transcriptConfidence=result?.confidence||state.transcriptConfidence;document.querySelector("#conversationAnswer").value=state.conversationAnswer;document.querySelector("#conversationAudio").innerHTML=result?.url?`<audio controls src="${result.url}" style="width:100%;margin-top:12px"></audio>`:"";status.textContent="Answer transcript ready";btn.textContent="Recording captured";save();try{const activeScenario=currentScenarioForPractice();const provider=await analysis.transcribeWithProvider({scenario:activeScenario?.title||"Current scenario",phase:"adaptive conversation",mode:state.mode,keywordHints:["reconciliation","validation","commercial impact","recovery"]});if(provider?.text){state.conversationAnswer=provider.text;document.querySelector("#conversationAnswer").value=provider.text;status.textContent="High-accuracy transcript ready";save()}}catch(error){detail.textContent="Provider transcription unavailable. The audio and editable draft are preserved."}}}catch(error){toast(`${error.message} Use the text fallback to continue.`)}}
  else if(name==="replayAI"){const question=[...state.conversation].reverse().find(turn=>turn.role==="ai")?.text;if(question)await speakAI(question)}
  else if(name==="generateFinalEvaluation"){const activeScenario=currentScenarioForPractice();state.finalEvaluation=await simulation.finalEvaluation({initialResponse:state.response,openingAudioRef:state.openingAudioRef,conversation:state.conversation,mode:state.mode,scenario:activeScenario,existingScoringMethodology:"five-level capability rubric plus IMPACT+R"});save();render()}
  else if(name==="restartConversation"){
    const previous=state.conversationSession?domain.clone(state.conversationSession):null;if(previous)state.attemptHistory.push(previous);state.attempt+=1;state.retryComparison=null;state.assessmentResult=null;state.finalEvaluation=null;state.conversation=[];state.conversationAnswer="";state.conversationError="";
    try{if(previous?.id&&(await services.health()).ok){const result=await services.retry(previous.id);syncConversationSession(result.session);state.stage="conversation";save();render();await speakAI(result.aiMessage.message)}else await startAssessmentConversation()}catch(error){await startAssessmentConversation()}
  }
  else if(name==="sendForReview"){if(!state.finalEvaluation)return toast("Complete the phase 6 evaluation first.");state.stage="submitted";save();render()}
  else if(name==="verifyTranscript"){const field=document.querySelector("#reviewTranscript");state.response=field.value.trim();if(!state.response)return toast("A verified transcript cannot be empty.");state.transcriptStatus="completed";state.evaluation=analysis.evaluateResponse(state.response,state.decision);if(state.finalEvaluation){const activeScenario=currentScenarioForPractice();state.finalEvaluation=await simulation.finalEvaluation({initialResponse:state.response,openingAudioRef:state.openingAudioRef,conversation:state.conversation,mode:state.mode,scenario:activeScenario,existingScoringMethodology:"five-level capability rubric plus IMPACT+R"});}save();render();toast("Transcript verified; phase 6 evidence recalculated.")}
  else if(name==="approveFeedback"){
    if(state.transcriptStatus!=="completed")return toast("Verify the transcript before approving this judgement assessment.");
    if(state.assessmentResult?.id){try{const selected=Number(document.querySelector("[data-score].selected")?.dataset.score||0);const finalScore=selected?selected*20:state.assessmentResult.runningScores.finalScore;const review=await services.approve(state.assessmentResult.id,{finalScore,comments:document.querySelector("#rationale")?.value||"Evidence reviewed and approved.",overrideReason:finalScore!==state.assessmentResult.runningScores.finalScore?"Facilitator calibrated the evidence using the five-level rubric.":""});state.assessmentResult=review.assessmentResult}catch(error){return toast(error.message||"The review could not be approved.")}}
    state.approved=true;state.stage="feedback";save();render();toast("Feedback approved and released. Audit event recorded.")
  }
  else if(name==="saveReview")toast("Review draft saved without publishing.");
  else if(name==="completeReflection"){const t=document.querySelector("#reflectionText").value;if(t.trim().length<20)return toast("Add a little more detail to your reflection.");state.reflection=t;state.stage="completed";save();render()}
  else toast("Action completed in the demo workspace.");
}
async function speakAI(text){state.voiceStatus="speaking";save();const status=document.querySelector(".voice-state");if(status){status.classList.add("speaking");status.innerHTML="<span></span>AI speaking"}try{await simulation.speak(text,()=>{})}catch(error){toast(`${error.message}. The question remains available as text.`)}state.voiceStatus="idle";save();const latest=document.querySelector(".voice-state");if(latest){latest.classList.remove("speaking");latest.innerHTML="<span></span>Voice + text"}}
function capture(){state.response=document.querySelector("#responseText")?.value||"";state.justification=document.querySelector("#justification")?.value||"";state.decision=document.querySelector('input[name="decision"]:checked')?.value||"";state.openingAudioRef=state.openingAudioRef||analysis.runtime.captureMeta;save()}
async function initializeAuth() {
  render();
  try { const session = await services.authSession(); auth.user = session.user ? { ...session.user, role: normalizeRole(session.user.role) } : null; auth.status = session.authenticated ? "authenticated" : "unauthenticated"; if (auth.user) { state.role = auth.user.role; render(); hydrateServerContent(true); } else { state.role = null; renderAuth(); } }
  catch { auth.status = "unauthenticated"; auth.error = "The authentication service is unavailable. Start the TrustBuilder server and try again."; renderAuth(); }
}
initializeAuth();

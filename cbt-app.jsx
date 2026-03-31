import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as api from "./api";
import { setTokens, loadTokensFromStorage } from "./api/client";

class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError:false, error:null }; }
  static getDerivedStateFromError(error){ return { hasError:true, error }; }
  componentDidCatch(error){ this.setState({ hasError:true, error }); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
          <div style={{background:"#fff",borderRadius:16,padding:32,maxWidth:520,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.1)"}}>
            <h2 style={{margin:0,fontSize:20,fontWeight:800,color:"#0f172a"}}>Something went wrong</h2>
            <p style={{fontSize:13,color:"#64748b",marginTop:8}}>Please reload the page or try again.</p>
            <div style={{display:"flex",gap:10,marginTop:12}}>
              <button style={{background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontWeight:600,fontSize:14,cursor:"pointer"}} onClick={()=>window.location.reload()}>Reload</button>
              <button style={{background:"#f1f5f9",color:"#334155",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"}} onClick={()=>this.setState({hasError:false,error:null})}>Dismiss</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const CLASSES = ["SS1","SS2","SS3","JSS1","JSS2","JSS3"];

const LIVE_SESSIONS_KEY = "cbt_live_sessions";

// Helper: write this student's current exam state to localStorage
function broadcastSession(data) {
  try {
    const all = JSON.parse(localStorage.getItem(LIVE_SESSIONS_KEY) || "{}");
    all[data.studentId] = { ...data, lastSeen: Date.now() };
    localStorage.setItem(LIVE_SESSIONS_KEY, JSON.stringify(all));
  } catch {}
}
 
// Helper: remove student from live sessions (on submit / unmount)
function clearSession(studentId) {
  try {
    const all = JSON.parse(localStorage.getItem(LIVE_SESSIONS_KEY) || "{}");
    delete all[studentId];
    localStorage.setItem(LIVE_SESSIONS_KEY, JSON.stringify(all));
  } catch {}
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,9); }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function dateStr() { return new Date().toISOString(); }

// ─── TOAST ───────────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type="success") => {
    const id = uid();
    setToasts(t => [...t, {id, msg, type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const success = useCallback(m => add(m,"success"), [add]);
  const error   = useCallback(m => add(m,"error"),   [add]);
  const info    = useCallback(m => add(m,"info"),    [add]);

  return useMemo(() => ({ toasts, success, error, info }), [toasts, success, error, info]);
}

function ToastContainer({ toasts }) {
  return (
    <div style={{position:"fixed",top:20,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding:"12px 20px", borderRadius:8, fontSize:14, fontWeight:500,
          background: t.type==="success"?"#16a34a":t.type==="error"?"#dc2626":"#2563eb",
          color:"#fff", boxShadow:"0 4px 20px rgba(0,0,0,0.2)",
          animation:"slideIn 0.3s ease"
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:12,padding:"28px 32px",width:"100%",maxWidth:wide?720:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:700,color:"#0f172a"}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#64748b",lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── FORM COMPONENTS ─────────────────────────────────────────────────────────
const inputStyle = {width:"100%",padding:"10px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const labelStyle = {display:"block",fontSize:13,fontWeight:600,color:"#374151",marginBottom:6};
const btnPrimary = {background:"#1d4ed8",color:"#fff",border:"none",borderRadius:8,padding:"10px 22px",fontWeight:600,fontSize:14,cursor:"pointer"};
const btnDanger = {background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"};
const btnGhost = {background:"#f1f5f9",color:"#334155",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer"};

function Field({ label, children }) {
  return <div style={{marginBottom:16}}><label style={labelStyle}>{label}</label>{children}</div>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type="text",
  ariaLabel,
  pattern,
  maxLength=120,
  multiline=false,
  disabled=false,
  readOnly=false,
  onEnter,
  onEsc
}) {
  const [focused, setFocused] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef(null);
  const styleFocused = focused ? {border:"1.5px solid #93c5fd", boxShadow:"0 0 0 3px rgba(59,130,246,0.2)"} : null;
  const baseStyle = {...inputStyle, direction:"ltr", ...styleFocused};
  const validate = v => {
    if (pattern) {
      const ok = new RegExp(pattern).test(v) || v === "";
      setErr(ok ? "" : "Invalid format");
    } else {
      setErr("");
    }
  };
  const handleChange = e => {
    let v = e.target.value;
    if (maxLength && v.length > maxLength) v = v.slice(0, maxLength);
    onChange({ target: { value: v } });
    validate(v);
  };
  const handleKeyDown = e => {
    if (e.key === "Enter" && onEnter) onEnter();
    if (e.key === "Escape" && onEsc) onEsc();
  };
  const handlePaste = e => {
    if (!pattern) return;
    const txt = e.clipboardData.getData("text");
    const filtered = txt.split("").filter(ch => new RegExp(pattern).test(ch)).join("");
    if (filtered !== txt) {
      e.preventDefault();
      const cur = value || "";
      const start = ref.current ? ref.current.selectionStart : cur.length;
      const end = ref.current ? ref.current.selectionEnd : cur.length;
      let next = cur.slice(0,start) + filtered + cur.slice(end);
      if (maxLength && next.length > maxLength) next = next.slice(0, maxLength);
      onChange({ target: { value: next } });
      const pos = start + filtered.length;
      validate(next);
      requestAnimationFrame(() => {
        try { ref.current && ref.current.setSelectionRange(pos, pos); } catch {}
      });
    }
  };
  const commonProps = {
    ref,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    placeholder,
    readOnly,
    disabled,
    'aria-label': ariaLabel,
    'aria-invalid': !!err,
    'aria-describedby': err ? 'input-error' : undefined,
    style: baseStyle,
  };
  return (
    <div>
      {multiline ? (
        <textarea {...commonProps} rows={4} />
      ) : (
        <input {...commonProps} type={type} />
      )}
      {err && <div id="input-error" style={{color:"#dc2626",fontSize:12,marginTop:6}}>{err}</div>}
      {maxLength ? <div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>{(value||"").length}/{maxLength}</div> : null}
    </div>
  );
}

// ─── STUDENT FORM ─────────────────────────────────────────────────────────────
function StudentForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { regNumber: "", fullName: "", className: "SS3", email: "", gender: "", isActive: true });
  const set = k => e => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };
  return (
    <div>
      <Field label="Registration Number *"><input style={inputStyle} value={form.regNumber} onChange={set("regNumber")} placeholder="STU/2024/005" /></Field>
      <Field label="Full Name *"><input style={inputStyle} value={form.fullName} onChange={set("fullName")} placeholder="John Doe" /></Field>
      <Field label="Class *">
        <select style={inputStyle} value={form.className} onChange={set("className")}>
          {CLASSES.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Email (optional)"><input style={inputStyle} value={form.email} onChange={set("email")} placeholder="student@school.edu" type="email" /></Field>
      <Field label="Gender (optional)">
        <select style={inputStyle} value={form.gender} onChange={set("gender")}>
          <option value="">-- Select --</option>
          <option>Male</option><option>Female</option>
        </select>
      </Field>
      <Field label="Account Status">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginTop: 8 }}>
          <input type="checkbox" checked={form.isActive} onChange={set("isActive")} style={{ accentColor: "#1d4ed8" }} />
          Active Account (Allowed to login and take exams)
        </label>
      </Field>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
        <button type="button" style={btnPrimary} onClick={() => onSave(form)}>Save Student</button>
      </div>
    </div>
  );
}

// ─── QUESTION FORM ────────────────────────────────────────────────────────────
function QuestionForm({ initial, onSave, onClose, loading }) {
  const [form, setForm] = useState(initial || { subject: "", class_name: "SS3", question_text: "", type: "mcq", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", answer: "", answerBool: true });
  const set = k => e => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Subject *">
          <input style={inputStyle} value={form.subject || ""} onChange={set("subject")} placeholder="e.g. Mathematics" disabled={loading} />
        </Field>
        <Field label="Class *">
          <select style={inputStyle} value={form.class_name || "SS3"} onChange={set("class_name")} disabled={loading}>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Question Type *">
          <select style={inputStyle} value={form.type} onChange={set("type")} disabled={loading}>
            <option value="mcq">Multiple Choice</option>
            <option value="fib">Fill in the Blanks</option>
            <option value="boolean">True / False</option>
          </select>
        </Field>
      </div>
      <Field label="Question Text *">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.question_text} onChange={set("question_text")} placeholder="Enter question..." disabled={loading} />
      </Field>

      {form.type === "mcq" && (
        <>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Answer Options (select correct one)</p>
          {['A', 'B', 'C', 'D'].map((opt) => (
            <div key={opt} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <input type="radio" name="correct" checked={form.correct_option === opt} onChange={() => setForm(f => ({ ...f, correct_option: opt }))} style={{ accentColor: "#1d4ed8" }} disabled={loading} />
              <span style={{ fontSize: 13, color: "#64748b", minWidth: 20 }}>{opt}.</span>
              <input style={{ ...inputStyle, flex: 1 }} value={form[`option_${opt.toLowerCase()}`]} onChange={set(`option_${opt.toLowerCase()}`)} placeholder={`Option ${opt}`} disabled={loading} />
            </div>
          ))}
        </>
      )}

      {form.type === "fib" && (
        <Field label="Correct Answer (Exact Match) *">
          <input style={inputStyle} value={form.answer} onChange={set("answer")} placeholder="Enter the correct answer..." disabled={loading} />
        </Field>
      )}

      {form.type === "boolean" && (
        <Field label="Correct Answer *">
          <select style={inputStyle} value={form.answerBool ? "true" : "false"} onChange={e => setForm(f => ({ ...f, answerBool: e.target.value === "true" }))} disabled={loading}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </Field>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" style={btnGhost} onClick={onClose} disabled={loading}>Cancel</button>
        <button type="button" style={{...btnPrimary, opacity: loading ? 0.7 : 1}} onClick={() => onSave(form)} disabled={loading}>
          {loading ? "Saving..." : "Save Question"}
        </button>
      </div>
    </div>
  );
}

// ─── EXAM FORM ────────────────────────────────────────────────────────────────
function ExamForm({ initial, questions, onSave, onClose, loading }) {
  const [form, setForm] = useState(initial || { title: "", subject: "", class_name: "SS3", description: "", duration_minutes: 30, starts_at: "", ends_at: "", is_active: true, question_ids: [] });
  const [isRandomized, setIsRandomized] = useState(() => localStorage.getItem('exam_randomEnabled') === 'true');

  useEffect(() => {
    localStorage.setItem('exam_randomEnabled', isRandomized);
  }, [isRandomized]);

  const set = k => e => { const v = e.target.type === "checkbox" ? e.target.checked : e.target.value; setForm(f => ({ ...f, [k]: v })); };
  const toggleQ = id => setForm(f => {
    const ids = f.question_ids.includes(id) ? f.question_ids.filter(x => x !== id) : [...f.question_ids, id];
    return { ...f, question_ids: ids };
  });

  const filteredQs = useMemo(() => {
    const s = (form.subject || "").trim().toLowerCase();
    const c = (form.class_name || "").trim().toLowerCase();
    return (questions || []).filter(q => {
      if (!q) return false;
      const qSubject = (q.subject || "").trim().toLowerCase();
      const qClass = (q.class_name || "").trim().toLowerCase();
      return (s === "" || qSubject === s) && (c === "" || qClass === c);
    });
  }, [questions, form.subject, form.class_name]);

  const shuffledQs = useMemo(() => {
    if (!isRandomized) return filteredQs;
    const arr = [...filteredQs];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [filteredQs, isRandomized]);

  const allSelected = filteredQs.length > 0 && filteredQs.every(q => form.question_ids.includes(q.id));

  const toggleSelectAll = () => {
    const nextIds = allSelected 
      ? form.question_ids.filter(id => !filteredQs.find(q => q.id === id))
      : Array.from(new Set([...form.question_ids, ...filteredQs.map(q => q.id)]));
    
    setForm(f => ({ ...f, question_ids: nextIds }));
    
    const event = new CustomEvent('exam:selectall', { detail: !allSelected });
    window.dispatchEvent(event);
  };

  const btnControlStyle = {
    width: 32, height: 32, borderRadius: 6, border: "1.5px solid #e2e8f0", 
    background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", 
    justifyContent: "center", fontSize: 16, transition: "all 0.2s ease",
    padding: 0, outline: "none"
  };

  return (
    <div>
      <Field label="Exam Title *"><input style={inputStyle} value={form.title} onChange={set("title")} placeholder="e.g. Mathematics Mid-Term" disabled={loading} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Subject *">
          <input style={inputStyle} value={form.subject || ""} onChange={set("subject")} placeholder="e.g. Mathematics" disabled={loading} />
        </Field>
        <Field label="Class *">
          <select style={inputStyle} value={form.class_name || "SS3"} onChange={set("class_name")} disabled={loading}>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description"><textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={set("description")} placeholder="Exam description..." disabled={loading} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Duration (mins)"><input style={inputStyle} type="number" value={form.duration_minutes} onChange={set("duration_minutes")} min={5} disabled={loading} /></Field>
        <Field label="Active">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: loading ? "default" : "pointer", marginTop: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={set("is_active")} style={{ accentColor: "#1d4ed8" }} disabled={loading} />
            Active
          </label>
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Start Time (optional)"><input style={inputStyle} type="datetime-local" value={form.starts_at} onChange={set("starts_at")} disabled={loading} /></Field>
        <Field label="End Time (optional)"><input style={inputStyle} type="datetime-local" value={form.ends_at} onChange={set("ends_at")} disabled={loading} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>
          Select Questions ({form.question_ids.length} selected)
        </p>
        <div style={{ display: "flex", gap: 8, direction: "ltr" /* Support RTL via flex */ }}>
          <button 
            type="button"
            style={{ ...btnControlStyle, background: isRandomized ? "#eff6ff" : "#fff", borderColor: isRandomized ? "#3b82f6" : "#e2e8f0" }}
            onClick={() => setIsRandomized(!isRandomized)}
            aria-pressed={isRandomized}
            aria-label="Randomize Questions"
            title="Randomize Questions"
          >
            🎲
          </button>
          <button 
            type="button"
            style={{ ...btnControlStyle, color: allSelected ? "#1d4ed8" : "#374151" }}
            onClick={toggleSelectAll}
            aria-label={allSelected ? "Deselect All" : "Select All"}
            title={allSelected ? "Deselect All" : "Select All"}
          >
            {allSelected ? "☑️" : "⬜"}
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: 10 }}>
        {shuffledQs.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No questions found for this subject and class.</p>
            <p style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>Try changing the filters above or create new questions first.</p>
          </div>
        )}
        {shuffledQs.map(q => (
          <label key={q.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: loading ? "default" : "pointer", padding: "6px 0", borderBottom: "1px solid #f1f5f9", opacity: loading ? 0.7 : 1 }}>
            <input type="checkbox" checked={form.question_ids.includes(q.id)} onChange={() => toggleQ(q.id)} style={{ marginTop: 2, accentColor: "#1d4ed8" }} disabled={loading} />
            <span style={{ fontSize: 13, color: "#374151" }}>{q.question_text}</span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" style={btnGhost} onClick={onClose} disabled={loading}>Cancel</button>
        <button type="button" style={{...btnPrimary, opacity: loading ? 0.7 : 1}} onClick={() => onSave(form)} disabled={loading}>
          {loading ? "Saving Exam..." : "Save Exam"}
        </button>
      </div>
    </div>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ children, color="blue" }) {
  const map = {blue:"#dbeafe:#1d4ed8",green:"#dcfce7:#16a34a",red:"#fee2e2:#dc2626",yellow:"#fef9c3:#ca8a04",gray:"#f1f5f9:#64748b"};
  const [bg,tc] = map[color].split(":");
  return <span style={{background:bg,color:tc,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>{children}</span>;
}

// ─── STATS CARD ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }) {
  return (
    <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",display:"flex",alignItems:"center",gap:16}}>
      <div style={{width:48,height:48,borderRadius:12,background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{icon}</div>
      <div>
        <div style={{fontSize:28,fontWeight:800,color:"#0f172a",lineHeight:1}}>{value}</div>
        <div style={{fontSize:13,color:"#64748b",marginTop:4}}>{label}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function CreateUserModal({ onClose, onCreate, toast }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"admin" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) e.email = "Valid email is required";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (!["admin","super_admin"].includes(form.role)) e.role = "Invalid role";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(2); };
  const back = () => setStep(1);

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await onCreate(form);
      toast.success("User created successfully");
      onClose();
    } catch {}
    setLoading(false);
  };

  return (
    <Modal title="Create User" onClose={onClose}>
      {step===1 && (
        <div>
          <Field label="Name *">
            <input style={inputStyle} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Jane Admin"/>
            {errors.name && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.name}</div>}
          </Field>
          <Field label="Email *">
            <input style={inputStyle} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="admin@cbtportal.edu" type="email"/>
            {errors.email && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.email}</div>}
          </Field>
          <Field label="Password *">
            <input style={inputStyle} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="At least 6 characters" type="password"/>
            {errors.password && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.password}</div>}
          </Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:12}}>
            <button style={btnGhost} onClick={onClose}>Cancel</button>
            <button style={btnPrimary} onClick={next}>Next →</button>
          </div>
        </div>
      )}
      {step===2 && (
        <div>
          <Field label="Role *">
            <select style={inputStyle} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            {errors.role && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.role}</div>}
          </Field>
          <div style={{background:"#f8fafc",borderRadius:8,padding:16,marginTop:12,fontSize:13,color:"#374151"}}>
            <div style={{fontWeight:700,marginBottom:6}}>Review</div>
            <div><strong>Name:</strong> {form.name}</div>
            <div><strong>Email:</strong> {form.email}</div>
            <div><strong>Role:</strong> {form.role}</div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,marginTop:16}}>
            <button style={btnGhost} onClick={back}>← Back</button>
            <button style={{...btnPrimary,opacity:loading?0.7:1}} disabled={loading} onClick={submit}>
              {loading ? "Creating..." : "Create User"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BulkUserUploadModal({ onClose, onBulkCreate, toast }) {
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const downloadTemplate = () => {
    const rows = [
      ["name","email","password","role"],
      ["Jane Admin","jane@cbtportal.edu","strongpass","admin"],
      ["John Super","john@cbtportal.edu","superpass","super_admin"],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "bulk_users_template.csv";
    a.click();
  };

  const parseCSV = text => {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { setParsed([]); setErrors(["No data rows found"]); return; }
    const header = lines[0].toLowerCase().replace(/"/g,"").split(",").map(h=>h.trim());
    const req = ["name","email","password","role"];
    const missing = req.filter(r => !header.includes(r));
    if (missing.length) { setParsed([]); setErrors([`Missing columns: ${missing.join(", ")}`]); return; }
    const rows = [], errs = [];
    const emails = new Set();
    lines.slice(1).forEach((line, idx) => {
      const rowNum = idx + 2;
      const cols = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      cols.push(cur.trim());
      const get = k => cols[header.indexOf(k)]?.replace(/"/g,"").trim() || "";
      const name = get("name"), email = get("email"), password = get("password"), role = get("role");
      if (!name) { errs.push(`Row ${rowNum}: name required`); return; }
      if (!email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) { errs.push(`Row ${rowNum}: invalid email`); return; }
      if (emails.has(email.toLowerCase())) { errs.push(`Row ${rowNum}: duplicate email in file`); return; }
      emails.add(email.toLowerCase());
      if (password.length < 6) { errs.push(`Row ${rowNum}: password must be 6+ chars`); return; }
      if (!["admin","super_admin"].includes(role)) { errs.push(`Row ${rowNum}: role must be admin or super_admin`); return; }
      rows.push({ name, email, password, role });
    });
    setParsed(rows); setErrors(errs);
  };

  const handleFile = f => {
    if (!f) return;
    if (!f.name.endsWith(".csv")) { toast.error("Please upload a .csv file."); return; }
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(f);
  };

  const handleDrop = e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const confirm = async () => {
    if (parsed.length === 0) { toast.error("No valid users to create."); return; }
    await onBulkCreate(parsed);
    onClose();
  };

  return (
    <Modal title="Bulk Create Users" onClose={onClose} wide>
      <div style={{marginBottom:16}}>
        <button onClick={downloadTemplate} style={{...btnGhost,marginBottom:12,width:"100%",padding:"11px",border:"1.5px dashed #cbd5e1",background:"#f8fafc",fontSize:14}}>
          ⬇ Download CSV Template
        </button>
        <div
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={handleDrop}
          onClick={()=>fileRef.current.click()}
          style={{
            border:`2px dashed ${dragging?"#3b82f6":"#cbd5e1"}`,
            borderRadius:12, padding:"36px 20px", textAlign:"center", cursor:"pointer",
            background:dragging?"#eff6ff":"#fafafa", transition:"all 0.2s"
          }}
        >
          <div style={{fontSize:40,marginBottom:10}}>📂</div>
          <p style={{margin:"0 0 6px",fontSize:15,fontWeight:600,color:"#334155"}}>Drop your CSV file here</p>
          <p style={{margin:0,fontSize:13,color:"#94a3b8"}}>or click to browse</p>
          <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
        </div>
      </div>
      <div>
        <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          {parsed.length>0 && <div style={{background:"#dcfce7",color:"#16a34a",padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:600}}>✓ {parsed.length} ready</div>}
          {errors.length>0 && <div style={{background:"#fee2e2",color:"#dc2626",padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:600}}>⚠ {errors.length} error{errors.length!==1?"s":""}</div>}
        </div>
        {errors.length>0 && (
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:12,marginBottom:12,maxHeight:140,overflowY:"auto"}}>
            {errors.map((e,i)=><p key={i} style={{margin:"3px 0",fontSize:12,color:"#dc2626"}}>• {e}</p>)}
          </div>
        )}
        {parsed.length>0 && (
          <div style={{maxHeight:260,overflowY:"auto",border:"1.5px solid #e2e8f0",borderRadius:10}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  {["#","Name","Email","Role"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.map((u,i)=>(
                  <tr key={i} style={{borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"8px 12px",fontSize:12,color:"#94a3b8"}}>{i+1}</td>
                    <td style={{padding:"8px 12px",fontSize:13}}>{u.name}</td>
                    <td style={{padding:"8px 12px",fontSize:13,color:"#1d4ed8"}}>{u.email}</td>
                    <td style={{padding:"8px 12px",fontSize:13}}>{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:12}}>
          <button style={btnGhost} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} onClick={confirm} disabled={parsed.length===0}>Create {parsed.length} User{parsed.length!==1?"s":""}</button>
        </div>
      </div>
    </Modal>
  );
}

function UserManagement({ users, setUsers, toast }) {
  const create = async (u) => {
    try {
      const res = await api.createUser(u);
      const newUser = res.data;
      setUsers(arr => [...arr, { 
        id: String(newUser.id), 
        name: newUser.name, 
        email: newUser.email, 
        role: newUser.role, 
        createdAt: newUser.created_at 
      }]);
      toast.success("User created.");
      return true;
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to create user.");
      return false;
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = (users||[]).filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#0f172a"}}>User Management</h1>
        <div style={{display:"flex",gap:10}}>
          <button style={btnPrimary} onClick={()=>setShowCreate(true)}>+ Create User</button>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <input style={{...inputStyle,maxWidth:280}} placeholder="Search name or email…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <span style={{marginLeft:"auto",fontSize:13,color:"#64748b",alignSelf:"center"}}>{filtered.length} user{filtered.length!==1?"s":""}</span>
      </div>
      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#f8fafc"}}>
              {["Name","Email","Role","Created","Actions"].map(h=>(
                <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{borderTop:"1px solid #f1f5f9"}}>
                <td style={{padding:"12px 16px",fontSize:14,fontWeight:600,color:"#0f172a"}}>{u.name}</td>
                <td style={{padding:"12px 16px",fontSize:14,color:"#1d4ed8"}}>{u.email}</td>
                <td style={{padding:"12px 16px"}}><Badge color={u.role==="super_admin"?"green":"blue"}>{u.role}</Badge></td>
                <td style={{padding:"12px 16px",fontSize:13,color:"#64748b"}}>{u.createdAt?new Date(u.createdAt).toLocaleString():"—"}</td>
                <td style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:8}}>
                    <button style={btnGhost} onClick={()=>setEditUser(u)}>Edit</button>
                    <button style={btnDanger} onClick={async ()=>{
                      if (confirm("Delete this user?")) {
                        try {
                          await api.deleteUser(Number(u.id));
                          setUsers(arr => arr.filter(x=>x.id!==u.id));
                          toast.success("User deleted.");
                        } catch (e) {
                          toast.error(e.response?.data?.message || "Failed to delete user.");
                        }
                      }
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={5} style={{padding:32,textAlign:"center",color:"#94a3b8"}}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>
      {showCreate && <CreateUserModal onClose={()=>setShowCreate(false)} onCreate={create} toast={toast}/>}
      {editUser && <EditUserModal user={editUser} onClose={()=>setEditUser(null)} onSave={async (upd)=>{
        try {
          const res = await api.updateUser(Number(editUser.id), upd);
          const updatedUser = res.data;
          setUsers(arr => arr.map(x => x.id===editUser.id ? {
            ...x, 
            name: updatedUser.name, 
            email: updatedUser.email, 
            role: updatedUser.role 
          } : x));
          toast.success("User updated.");
          setEditUser(null);
        } catch (e) {
          toast.error(e.response?.data?.message || "Failed to update user.");
        }
      }}/>}
    </div>
  );
}

function EditUserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role, password: "" });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) e.email = "Valid email is required";
    if (form.password && form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (!["admin","super_admin"].includes(form.role)) e.role = "Invalid role";
    setErrors(e); return Object.keys(e).length===0;
  };
  const save = () => { if (validate()) onSave(form); };
  return (
    <Modal title="Edit User" onClose={onClose}>
      <Field label="Name *">
        <input style={inputStyle} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        {errors.name && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.name}</div>}
      </Field>
      <Field label="Email *">
        <input style={inputStyle} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} type="email"/>
        {errors.email && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.email}</div>}
      </Field>
      <Field label="Role *">
        <select style={inputStyle} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        {errors.role && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.role}</div>}
      </Field>
      <Field label="New Password (optional)">
        <div style={{position:"relative"}}>
          <input
            style={{...inputStyle,paddingRight:42}}
            type={showPw?"text":"password"}
            value={form.password}
            onChange={e=>setForm(f=>({...f,password:e.target.value}))}
            placeholder="Leave blank to keep existing password"
          />
          <button
            type="button"
            onClick={()=>setShowPw(s=>!s)}
            aria-pressed={showPw}
            aria-label={showPw?"Hide password":"Show password"}
            style={{position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#64748b", padding:6}}
          >
            {showPw ? "🙈" : "👁️"}
          </button>
        </div>
        {errors.password && <div style={{color:"#dc2626",fontSize:12,marginTop:6}}>{errors.password}</div>}
      </Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:12}}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={save}>Save Changes</button>
      </div>
    </Modal>
  );
}

function Dashboard({ students, exams, results, questions }) {
  const passed = results.filter(r => (r.score/r.total)>=0.5).length;
  return (
    <div>
      <h1 style={{fontSize:24,fontWeight:800,color:"#0f172a",marginBottom:24}}>Dashboard Overview</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:32}}>
        <StatCard icon="👥" label="Total Students" value={students.length} color="#dbeafe"/>
        <StatCard icon="📋" label="Exams Created" value={exams.length} color="#dcfce7"/>
        <StatCard icon="❓" label="Questions" value={questions.length} color="#fef9c3"/>
        <StatCard icon="✅" label="Submissions" value={results.length} color="#f3e8ff"/>
        <StatCard icon="🏆" label="Pass Rate" value={results.length?`${Math.round(passed/results.length*100)}%`:"–"} color="#fee2e2"/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700}}>Recent Submissions</h3>
          {results.length===0 && <p style={{color:"#94a3b8",fontSize:14}}>No submissions yet.</p>}
          {results.slice(-5).reverse().map(r => {
            const s = students.find(x=>x.id===r.studentId);
            const e = exams.find(x=>x.id===r.examId);
            const pct = Math.round(r.score/r.total*100);
            return (
              <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#0f172a"}}>{s?.fullName||"Unknown"}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>{e?.title||"Unknown Exam"}</div>
                </div>
                <Badge color={pct>=50?"green":"red"}>{r.score}/{r.total} ({pct}%)</Badge>
              </div>
            );
          })}
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
          <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:700}}>Active Exams</h3>
          {exams.filter(e=>e.is_active).length===0 && <p style={{color:"#94a3b8",fontSize:14}}>No active exams.</p>}
          {exams.filter(e=>e.is_active).map(e => (
            <div key={e.id} style={{padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
              <div style={{fontSize:14,fontWeight:600,color:"#0f172a"}}>{e.title}</div>
              <div style={{fontSize:12,color:"#64748b"}}>{e.className || "All"} · {e.duration_minutes} mins · {e.question_ids?.length || 0} questions</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BULK STUDENT UPLOAD MODAL ─────────────────────────────────────────────────
function BulkStudentUploadModal({ onClose, onImport, existingStudents, toast }) {
  const [step, setStep] = useState("upload"); // "upload" | "preview"
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const downloadTemplate = () => {
    const rows = [
      ["reg_number","full_name","class","email","gender"],
      ["STU/2024/010","John Doe","SS3","john@school.edu","Male"],
      ["STU/2024/011","Jane Smith","SS2","","Female"],
      ["STU/2024/012","Ahmed Musa","JSS1","",""],
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "bulk_students_template.csv";
    a.click();
  };

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return { rows:[], errs:["File appears empty or has no data rows."], skips:[] };
    const header = lines[0].toLowerCase().replace(/"/g,"").split(",").map(h => h.trim());
    const required = ["reg_number","full_name","class"];
    const missing = required.filter(r => !header.includes(r));
    if (missing.length) return { rows:[], errs:[`Missing required columns: ${missing.join(", ")}`], skips:[] };

    const rows = [], errs = [], skips = [];
    lines.slice(1).forEach((line, idx) => {
      const rowNum = idx + 2;
      const cols = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      cols.push(cur.trim());

      const get = key => { const i = header.indexOf(key); return i>=0 ? (cols[i]||"").replace(/"/g,"").trim() : ""; };
      const regNumber = get("reg_number");
      const fullName  = get("full_name");
      const className = get("class");
      const email     = get("email");
      const gender    = get("gender");

      if (!regNumber) { errs.push(`Row ${rowNum}: reg_number is empty.`); return; }
      if (!fullName)  { errs.push(`Row ${rowNum}: full_name is empty.`); return; }
      if (!className) { errs.push(`Row ${rowNum}: class is empty.`); return; }
      if (gender && !["male","female",""].includes(gender.toLowerCase())) {
        errs.push(`Row ${rowNum}: gender must be Male, Female, or blank (got "${gender}").`); return;
      }
      // duplicate within file
      if (rows.find(r => r.regNumber.toLowerCase() === regNumber.toLowerCase())) {
        skips.push(`Row ${rowNum}: reg_number "${regNumber}" appears more than once in file — skipped.`); return;
      }
      // duplicate against existing
      if (existingStudents.find(s => s.regNumber.toLowerCase() === regNumber.toLowerCase())) {
        skips.push(`Row ${rowNum}: "${regNumber}" already registered — skipped.`); return;
      }
      const normalGender = gender ? (gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()) : "";
      rows.push({ regNumber, fullName, className, email, gender: normalGender });
    });
    return { rows, errs, skips };
  };

  const handleFile = file => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a .csv file."); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const { rows, errs, skips } = parseCSV(e.target.result);
      setParsed(rows); setErrors(errs); setSkipped(skips);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleDrop = e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const confirmImport = () => {
    onImport(parsed);
    onClose();
  };

  const totalIssues = errors.length + skipped.length;

  return (
    <Modal title="Bulk Student Registration" onClose={onClose} wide>
      {step === "upload" && (
        <div>
          {/* Instructions */}
          <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:16,marginBottom:20}}>
            <p style={{margin:"0 0 8px",fontSize:13,fontWeight:700,color:"#1d4ed8"}}>📋 CSV Format Instructions</p>
            <p style={{margin:"0 0 8px",fontSize:13,color:"#1e40af"}}>Required columns:</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              {["reg_number","full_name","class"].map(col=>(
                <code key={col} style={{background:"#dbeafe",padding:"3px 10px",borderRadius:4,fontSize:12,color:"#1e40af",fontWeight:700}}>{col} *</code>
              ))}
              {["email","gender"].map(col=>(
                <code key={col} style={{background:"#f1f5f9",padding:"3px 10px",borderRadius:4,fontSize:12,color:"#64748b"}}>{col}</code>
              ))}
            </div>
            <p style={{margin:0,fontSize:12,color:"#3b82f6"}}>
              <strong>gender</strong> accepts: Male / Female (or leave blank) · Duplicate reg numbers are automatically skipped.
            </p>
          </div>

          <button onClick={downloadTemplate} style={{...btnGhost,marginBottom:20,width:"100%",padding:"11px",border:"1.5px dashed #cbd5e1",background:"#f8fafc",fontSize:14}}>
            ⬇ Download CSV Template
          </button>

          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragging(true)}}
            onDragLeave={()=>setDragging(false)}
            onDrop={handleDrop}
            onClick={()=>fileRef.current.click()}
            style={{
              border:`2px dashed ${dragging?"#3b82f6":"#cbd5e1"}`,
              borderRadius:12, padding:"44px 20px", textAlign:"center", cursor:"pointer",
              background:dragging?"#eff6ff":"#fafafa", transition:"all 0.2s"
            }}
          >
            <div style={{fontSize:44,marginBottom:10}}>👥</div>
            <p style={{margin:"0 0 6px",fontSize:15,fontWeight:600,color:"#334155"}}>Drop your CSV file here</p>
            <p style={{margin:0,fontSize:13,color:"#94a3b8"}}>or click to browse · .csv files only</p>
            <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          {/* Summary badges */}
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            {parsed.length > 0 && (
              <div style={{background:"#dcfce7",color:"#16a34a",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>
                ✓ {parsed.length} student{parsed.length!==1?"s":""} ready to register
              </div>
            )}
            {skipped.length > 0 && (
              <div style={{background:"#fef9c3",color:"#ca8a04",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>
                ⟳ {skipped.length} duplicate{skipped.length!==1?"s":""} skipped
              </div>
            )}
            {errors.length > 0 && (
              <div style={{background:"#fee2e2",color:"#dc2626",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>
                ✕ {errors.length} invalid row{errors.length!==1?"s":""}
              </div>
            )}
          </div>

          {/* Errors & skips */}
          {totalIssues > 0 && (
            <div style={{marginBottom:16,maxHeight:130,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
              {errors.length > 0 && (
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:12}}>
                  <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#dc2626"}}>❌ Errors (rows skipped):</p>
                  {errors.map((e,i) => <p key={i} style={{margin:"2px 0",fontSize:12,color:"#dc2626"}}>• {e}</p>)}
                </div>
              )}
              {skipped.length > 0 && (
                <div style={{background:"#fefce8",border:"1px solid #fde68a",borderRadius:10,padding:12}}>
                  <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#ca8a04"}}>⚠ Duplicates (skipped):</p>
                  {skipped.map((s,i) => <p key={i} style={{margin:"2px 0",fontSize:12,color:"#ca8a04"}}>• {s}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Preview table */}
          {parsed.length > 0 && (
            <div style={{maxHeight:280,overflowY:"auto",border:"1.5px solid #e2e8f0",borderRadius:10,marginBottom:16}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#f8fafc",position:"sticky",top:0}}>
                    {["#","Reg Number","Full Name","Class","Gender","Email"].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((s,i) => (
                    <tr key={i} style={{borderTop:"1px solid #f1f5f9"}}>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#94a3b8"}}>{i+1}</td>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:"#1d4ed8"}}>{s.regNumber}</td>
                      <td style={{padding:"9px 12px",fontSize:13}}>{s.fullName}</td>
                      <td style={{padding:"9px 12px"}}><Badge>{s.className}</Badge></td>
                      <td style={{padding:"9px 12px",fontSize:13,color:"#64748b"}}>{s.gender||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#64748b"}}>{s.email||"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parsed.length === 0 && (
            <div style={{textAlign:"center",padding:32,color:"#94a3b8",fontSize:14}}>
              No valid students to import. Please fix the errors and re-upload.
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
            <button style={btnGhost} onClick={()=>{setStep("upload");setParsed([]);setErrors([]);setSkipped([]);}}>← Upload Different File</button>
            <div style={{display:"flex",gap:10}}>
              <button style={btnGhost} onClick={onClose}>Cancel</button>
              <button
                style={{...btnPrimary,opacity:parsed.length===0?0.5:1}}
                disabled={parsed.length===0}
                onClick={confirmImport}
              >
                Register {parsed.length} Student{parsed.length!==1?"s":""}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── STUDENT MANAGEMENT ────────────────────────────────────────────────────────
function StudentManagement({ students, setStudents, toast }) {
  const [modal, setModal] = useState(null); // null | "add" | student obj
  const [showBulk, setShowBulk] = useState(false);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("All");

  const filtered = students.filter(s =>
    (filterClass === "All" || s.className === filterClass) &&
    (s.fullName.toLowerCase().includes(search.toLowerCase()) || s.regNumber.toLowerCase().includes(search.toLowerCase()))
  );

  const save = async (form) => {
    if (!form.regNumber.trim() || !form.fullName.trim()) { toast.error("Registration number and full name are required."); return; }
    try {
      if (modal === "add") {
        if (students.find(s => s.regNumber === form.regNumber)) { toast.error("Registration number already exists."); return; }
        const payload = {
          registration_number: form.regNumber.trim(),
          name: form.fullName.trim(),
          email: (form.email || "").trim() || `${form.regNumber.trim().replace(/\//g, '')}@cbtportal.edu`,
          password: "password123",
          class_name: (form.className || "").trim(),
          gender: (form.gender || "").trim(),
          is_active: form.isActive,
        };
        const res = await api.createStudent(payload);
        const r = res.data;
        const mapped = { id: String(r.id), regNumber: r.registration_number, fullName: r.name, className: r.class_name, email: r.email || "", gender: r.gender || "", isActive: Boolean(r.is_active) };
        setStudents(ss => [...ss, mapped]);
        toast.success("Student registered successfully.");
      } else {
        const payload = {
          registration_number: form.regNumber.trim(),
          name: form.fullName.trim(),
          email: (form.email || "").trim(),
          class_name: (form.className || "").trim(),
          gender: (form.gender || "").trim(),
          is_active: form.isActive,
        };
        const res = await api.updateStudent(Number(modal.id), payload);
        const r = res.data;
        const mapped = { id: String(r.id), regNumber: r.registration_number, fullName: r.name, className: r.class_name, email: r.email || "", gender: r.gender || "", isActive: Boolean(r.is_active) };
        setStudents(ss => ss.map(s => s.id === modal.id ? mapped : s));
        toast.success("Student updated.");
      }
      setModal(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save student.");
    }
  };

  const del = async id => {
    if (!confirm("Delete this student?")) return;
    try {
      await api.deleteStudent(Number(id));
      setStudents(ss => ss.filter(s => s.id !== id));
      toast.success("Deleted.");
    } catch (e) {
      toast.error("Failed to delete student.");
    }
  };

  const handleBulkImport = async newStudents => {
    try {
      const results = await Promise.all(newStudents.map(s => {
        const payload = {
          registration_number: s.regNumber.trim(),
          name: s.fullName.trim(),
          email: (s.email || "").trim() || `${s.regNumber.trim().replace(/\//g, '')}@cbtportal.edu`,
          password: "password123",
          class_name: (s.className || "").trim(),
          gender: (s.gender || "").trim(),
          is_active: true,
        };
        return api.createStudent(payload);
      }));
      const mapped = results.map(res => {
        const r = res.data;
        return { id: String(r.id), regNumber: r.registration_number, fullName: r.name, className: r.class_name, email: r.email || "", gender: r.gender || "", isActive: Boolean(r.is_active) };
      });
      setStudents(ss => [...ss, ...mapped]);
      toast.success(`${mapped.length} students registered successfully!`);
    } catch (e) {
      toast.error("Failed to bulk register some students.");
    }
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#0f172a"}}>Student Management</h1>
        <div style={{display:"flex",gap:10}}>
          <button style={{...btnGhost,border:"1.5px solid #cbd5e1"}} onClick={()=>setShowBulk(true)}>⬆ Bulk Register</button>
          <button style={btnPrimary} onClick={()=>setModal("add")}>+ Register Student</button>
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginBottom:16}}>
        <input style={{...inputStyle,maxWidth:280}} placeholder="Search name or reg number…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={{...inputStyle,maxWidth:160}} value={filterClass} onChange={e=>setFilterClass(e.target.value)}>
          <option value="All">All Classes</option>
          {CLASSES.map(c=><option key={c}>{c}</option>)}
        </select>
        <span style={{marginLeft:"auto",fontSize:13,color:"#64748b",alignSelf:"center"}}>{filtered.length} student{filtered.length!==1?"s":""}</span>
      </div>
      <div style={{background:"#fff",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#f8fafc"}}>
              {["Reg Number","Full Name","Class","Status","Email","Actions"].map(h=>(
                <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{borderTop:"1px solid #f1f5f9"}}>
                <td style={{padding:"12px 16px",fontSize:14,fontWeight:600,color:"#1d4ed8"}}>{s.regNumber}</td>
                <td style={{padding:"12px 16px",fontSize:14}}>{s.fullName}</td>
                <td style={{padding:"12px 16px"}}><Badge>{s.className}</Badge></td>
                <td style={{padding:"12px 16px"}}>
                  <Badge color={s.isActive ? "green" : "red"}>{s.isActive ? "Active" : "Disabled"}</Badge>
                </td>
                <td style={{padding:"12px 16px",fontSize:13,color:"#64748b"}}>{s.email||"—"}</td>
                <td style={{padding:"12px 16px"}}>
                  <div style={{display:"flex",gap:8}}>
                    <button style={btnGhost} onClick={()=>setModal(s)}>Edit</button>
                    <button style={btnDanger} onClick={()=>del(s.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={6} style={{padding:32,textAlign:"center",color:"#94a3b8"}}>No students found.</td></tr>}
          </tbody>
        </table>
      </div>
      {modal && (
        <Modal title={modal==="add"?"Register Student":"Edit Student"} onClose={()=>setModal(null)}>
          <StudentForm initial={modal==="add"?null:modal} onSave={save} onClose={()=>setModal(null)}/>
        </Modal>
      )}
      {showBulk && (
        <BulkStudentUploadModal
          onClose={()=>setShowBulk(false)}
          onImport={handleBulkImport}
          existingStudents={students}
          toast={toast}
        />
      )}
    </div>
  );
}

// ── BULK UPLOAD MODAL ─────────────────────────────────────────────────────────
function BulkUploadModal({ onClose, onImport, toast, importing, importProgress }) {
  const [step, setStep] = useState("upload"); // "upload" | "preview" | "report"
  const [parsed, setParsed] = useState([]);
  const [errors, setErrors] = useState([]);
  const [skipped, setSkipped] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [threshold, setThreshold] = useState(10); // % error threshold for rollback
  const fileRef = useRef();

  const downloadTemplate = () => {
    const csvRows = [
      ["type","subject","class","question","option_a","option_b","option_c","option_d","correct_option","expected_answer","answer_bool","score","difficulty","tags"],
      ["mcq","Mathematics","SS3","What is 2 + 2?","3","4","5","6","B","","",1,"easy","arithmetic,addition"],
      ["fib","English","SS2","Fill in: The capital of France is ____","","","","","","Paris","",2,"medium","geography"],
      ["boolean","Science","SS1","Water boils at 100°C at sea level","","","","","","","true",1,"easy","physics"],
    ];
    const csv = csvRows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "bulk_questions_template.csv";
    a.click();
  };

  const mapRow = (row, rowNum) => {
    const type = (row.type||"mcq").toLowerCase().trim();
    const subject = (row.subject||"").trim();
    const className = (row.class||row.class_name||"").trim();
    const text = (row.question||row.question_text||"").trim();
    const score = row.score ? Number(row.score) : 1;
    const difficulty = (row.difficulty||"").trim();
    const tags = (row.tags||"").split(",").map(t=>t.trim()).filter(Boolean);
    const errs = [];
    if (!subject) errs.push(`Row ${rowNum}: subject is empty`);
    if (!className) errs.push(`Row ${rowNum}: class is empty`);
    if (!text) errs.push(`Row ${rowNum}: question text is empty`);
    let q = null;
    if (type==="mcq") {
      const opts = [row.option_a,row.option_b,row.option_c,row.option_d].map(x=>(x||"").trim());
      if (opts.some(x=>!x)) errs.push(`Row ${rowNum}: MCQ requires 4 options`);
      const ans = (row.correct_option||"").toString().trim().toLowerCase();
      const map = { a:0,b:1,c:2,d:3,"1":0,"2":1,"3":2,"4":3 };
      const correct = map[ans];
      if (correct===undefined) errs.push(`Row ${rowNum}: correct_option must be A/B/C/D`);
      q = { type:"mcq", subject, className, text, options:opts, correct, score, difficulty, tags };
    } else if (type==="fib") {
      const expected = (row.expected_answer||row.answer||"").trim();
      if (!expected) errs.push(`Row ${rowNum}: expected_answer required for FIB`);
      q = { type:"fib", subject, className, text, answer:expected, score, difficulty, tags };
    } else if (type==="boolean") {
      const b = (row.answer_bool||row.answer_bool||row.answer||"").toString().trim().toLowerCase();
      const isTrue = b==="true" || b==="t" || b==="1" || b==="yes" || b==="y";
      const isFalse = b==="false" || b==="f" || b==="0" || b==="no" || b==="n";
      if (!isTrue && !isFalse) errs.push(`Row ${rowNum}: answer_bool must be true/false`);
      q = { type:"boolean", subject, className, text, answerBool:isTrue, score, difficulty, tags };
    } else {
      errs.push(`Row ${rowNum}: unsupported type "${type}"`);
      q = null;
    }
    return { q, errs };
  };

  const parseCSV = async (text) => {
    const lines = [];
    let curLine = "", inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') inQ = !inQ;
      if ((ch === '\n' || ch === '\r') && !inQ) {
        if (ch === '\r' && text[i+1] === '\n') i++;
        lines.push(curLine);
        curLine = "";
      } else {
        curLine += ch;
      }
    }
    if (curLine) lines.push(curLine);

    if (lines.length < 2) return { rows:[], errs:["Empty file or missing header"], skips:[] };
    
    const parseLine = (line) => {
      const cols = [];
      let cur = "", inQ = false;
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === '"') {
          if (inQ && line[j+1] === '"') { cur += '"'; j++; }
          else inQ = !inQ;
        }
        else if (ch === ',' && !inQ) { cols.push(cur); cur = ""; }
        else cur += ch;
      }
      cols.push(cur);
      return cols;
    };

    const header = parseLine(lines[0]).map(h => h.trim().toLowerCase());
    const getObj = (cols) => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = (cols[i] || "").trim(); });
      return obj;
    };

    const rows=[], errs=[], skips=[];
    let processed = 0;
    for (let i=1;i<lines.length;i++) {
      const rowNum = i+1;
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = parseLine(line);
      const { q, errs: rowErrs } = mapRow(getObj(cols), rowNum);
      if (rowErrs.length) errs.push(...rowErrs); else if (q) rows.push(q); else skips.push(`Row ${rowNum}: skipped`);
      processed++;
      if (processed % 500 === 0) { setProgress(Math.round((processed/lines.length)*100)); await new Promise(r=>setTimeout(r,0)); }
    }
    setProgress(100);
    return { rows, errs, skips };
  };

  const parseJSON = async (text) => {
    let data;
    try { data = JSON.parse(text); } catch { return { rows:[], errs:["Invalid JSON"], skips:[] }; }
    if (!Array.isArray(data)) return { rows:[], errs:["JSON root must be an array"], skips:[] };
    const rows=[], errs=[], skips=[];
    for (let i=0;i<data.length;i++) {
      const rowNum=i+1;
      const { q, errs: rowErrs } = mapRow(data[i], rowNum);
      if (rowErrs.length) errs.push(...rowErrs); else if (q) rows.push(q); else skips.push(`Row ${rowNum}: skipped`);
      if (i % 500 === 0) { setProgress(Math.round((i/data.length)*100)); await new Promise(r=>setTimeout(r,0)); }
    }
    setProgress(100);
    return { rows, errs, skips };
  };

  const handleFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const text = e.target.result;
      setProgress(0); setErrors([]); setSkipped([]); setParsed([]);
      const name = file.name.toLowerCase();
      let result;
      if (name.endsWith(".csv")) result = await parseCSV(text);
      else if (name.endsWith(".json")) result = await parseJSON(text);
      else { toast.error("Unsupported file format. Use .csv or .json"); return; }
      setParsed(result.rows); setErrors(result.errs); setSkipped(result.skips); setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleDrop = e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  const confirmImport = () => {
    const total = parsed.length + errors.length + skipped.length;
    const errPct = total ? Math.round((errors.length/total)*100) : 0;
    if (errPct > threshold) {
      toast.error(`Import aborted: error rate ${errPct}% exceeds threshold ${threshold}%`);
      setStep("report");
      return;
    }
    onImport(parsed);
  };

  return (
    <Modal title="Bulk Upload Questions" onClose={onClose} wide>
      {importing ? (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Importing Questions...</h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Please wait while we process your data. This may take a moment for large files.</p>
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <div style={{ height: 10, background: "#e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${importProgress}%`, background: "#3b82f6", transition: "width 0.3s ease-out" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: "#3b82f6" }}>{importProgress}% Complete</span>
              <span style={{ color: "#64748b" }}>{parsed.length} Questions</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {step === "upload" && (
            <div>
              <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:16,marginBottom:20}}>
                <p style={{margin:"0 0 8px",fontSize:13,fontWeight:700,color:"#1d4ed8"}}>📋 Supported Formats</p>
                <p style={{margin:"0 0 6px",fontSize:13,color:"#1e40af"}}>.csv and .json (Excel will be supported when the Excel parser is available)</p>
                <p style={{margin:"0 0 6px",fontSize:13,color:"#1e40af"}}>Columns: type, subject, class, question, option_a..d, correct_option, expected_answer, answer_bool, score, difficulty, tags</p>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <label style={{fontSize:12,color:"#64748b"}}>Rollback threshold (%)</label>
                  <input type="range" min={0} max={50} value={threshold} onChange={e=>setThreshold(Number(e.target.value))}/>
                  <span style={{fontSize:12,color:"#334155"}}>{threshold}%</span>
                </div>
              </div>
              <button onClick={downloadTemplate} style={{...btnGhost,marginBottom:20,width:"100%",padding:"11px",border:"1.5px dashed #cbd5e1",background:"#f8fafc"}}>
                ⬇ Download Template
              </button>
              <div
                onDragOver={e=>{e.preventDefault();setDragging(true)}}
                onDragLeave={()=>setDragging(false)}
                onDrop={handleDrop}
                onClick={()=>fileRef.current.click()}
                style={{
                  border:`2px dashed ${dragging?"#3b82f6":"#cbd5e1"}`,
                  borderRadius:12, padding:"40px 20px", textAlign:"center", cursor:"pointer",
                  background:dragging?"#eff6ff":"#fafafa", transition:"all 0.2s"
                }}
              >
                <div style={{fontSize:40,marginBottom:10}}>📂</div>
                <p style={{margin:"0 0 6px",fontSize:15,fontWeight:600,color:"#334155"}}>Drop your file here</p>
                <p style={{margin:0,fontSize:13,color:"#94a3b8"}}>or click to browse (.csv, .json)</p>
                <input ref={fileRef} type="file" accept=".csv,.json" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
              </div>
            </div>
          )}
          {step === "preview" && (
            <div>
              <div style={{display:"flex",gap:12,marginBottom:12,alignItems:"center"}}>
                <div style={{flex:1,height:6,background:"#e2e8f0",borderRadius:6,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${progress}%`,background:"#3b82f6",transition:"width 0.2s"}}/>
                </div>
                <span style={{fontSize:12,color:"#64748b"}}>{progress}%</span>
              </div>
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                {parsed.length > 0 && <div style={{background:"#dcfce7",color:"#16a34a",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>✓ {parsed.length} ready</div>}
                {skipped.length > 0 && <div style={{background:"#fef9c3",color:"#ca8a04",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>⟳ {skipped.length} skipped</div>}
                {errors.length > 0 && <div style={{background:"#fee2e2",color:"#dc2626",padding:"8px 16px",borderRadius:8,fontSize:13,fontWeight:600}}>⚠ {errors.length} errors</div>}
              </div>
              {errors.length > 0 && (
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:14,marginBottom:16,maxHeight:160,overflowY:"auto"}}>
                  {errors.map((e,i)=> <p key={i} style={{margin:"3px 0",fontSize:12,color:"#dc2626"}}>• {e}</p>)}
                </div>
              )}
              {parsed.length > 0 && (
                <div style={{maxHeight:300,overflowY:"auto",border:"1.5px solid #e2e8f0",borderRadius:10,marginBottom:16}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"#f8fafc",position:"sticky",top:0}}>
                        {["#","Type","Subject","Class","Question","Meta"].map(h=>(
                          <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((q,i)=>(
                        <tr key={i} style={{borderTop:"1px solid #f1f5f9"}}>
                          <td style={{padding:"8px 12px",fontSize:12,color:"#94a3b8"}}>{i+1}</td>
                          <td style={{padding:"8px 12px",fontSize:12}}>{q.type}</td>
                          <td style={{padding:"8px 12px",fontSize:12,fontWeight:600,color:"#1d4ed8"}}>{q.subject}</td>
                          <td style={{padding:"8px 12px",fontSize:12}}>{q.className}</td>
                          <td style={{padding:"8px 12px",fontSize:12,maxWidth:260}}>{q.text.length>80?q.text.slice(0,80)+"…":q.text}</td>
                          <td style={{padding:"8px 12px",fontSize:12,color:"#64748b"}}>
                            {q.type==="mcq" ? `A-D; correct=${String.fromCharCode(65+(q.correct??0))}` :
                             q.type==="fib" ? `Answer=${q.answer}` :
                             q.type==="boolean" ? `Answer=${q.answerBool?"True":"False"}` : ""}
                            {q.tags?.length ? ` · tags=${q.tags.join(",")}` : ""}
                            {q.difficulty ? ` · diff=${q.difficulty}` : ""}
                            {q.score ? ` · score=${q.score}` : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
                <button style={btnGhost} onClick={()=>{setStep("upload");setParsed([]);setErrors([]);setSkipped([]);setProgress(0);}}>← Upload Different File</button>
                <div style={{display:"flex",gap:10}}>
                  <button style={btnGhost} onClick={onClose}>Cancel</button>
                  <button style={{...btnPrimary,opacity:parsed.length===0?0.5:1}} disabled={parsed.length===0} onClick={confirmImport}>
                    Import {parsed.length} Question{parsed.length!==1?"s":""}
                  </button>
                </div>
              </div>
            </div>
          )}
          {step === "report" && (
            <div>
              <h3 style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:12}}>Upload Report</h3>
              <p style={{fontSize:13,color:"#64748b"}}>Import aborted due to high error rate. Review issues and re-upload.</p>
              {errors.length > 0 && (
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:14,marginBottom:16,maxHeight:200,overflowY:"auto"}}>
                  {errors.map((e,i)=> <p key={i} style={{margin:"3px 0",fontSize:12,color:"#dc2626"}}>• {e}</p>)}
                </div>
              )}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button style={btnGhost} onClick={()=>{setStep("upload");setParsed([]);setErrors([]);setSkipped([]);setProgress(0);}}>Try Again</button>
                <button style={btnPrimary} onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// ── QUESTION MANAGEMENT ───────────────────────────────────────────────────────
function QuestionManagement({ questions = [], setQuestions, toast }) {
  const [modal, setModal] = useState(null);
  const [showBulk, setShowBulk] = useState(false);
  const [filters, setFilters] = useState({ subject: "all", class: "all" });
  const [selected, setSelected] = useState([]);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const qs = await api.listQuestions({ per_page: 1000, class_name: filters.class, subject: filters.subject });
        setQuestions((qs.data || []).map(q => ({
          id: String(q.id),
          subject: q.subject,
          class_name: q.class_name,
          type: q.type || "mcq",
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          answer: q.answer,
          answerBool: q.answerBool,
        })));
      } catch (error) {
        toast.error("Failed to fetch questions.");
      }
    };
    fetch();
  }, [filters]);

  const handleFilterChange = (type, value) => {
    setFilters(f => ({ ...f, [type]: value }));
    setSelected([]);
  };

  const toggleSelect = id => {
    setSelected(s => s.includes(id) ? s.filter(i => i !== id) : [...s, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === questions.length) {
      setSelected([]);
    } else {
      setSelected(questions.map(q => q.id));
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.length} selected questions?`)) return;
    const idsToDelete = [...selected];
    const numericIds = idsToDelete.map(Number);
    
    // UI Feedback: Mark as deleting
    setDeletingIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.add(id));
      return next;
    });

    try {
      await api.bulkDeleteQuestions(numericIds);
      
      // Success: Remove from state
      setQuestions(qs => qs.filter(q => !idsToDelete.includes(q.id)));
      setSelected([]);
      toast.success(`${idsToDelete.length} questions deleted.`);
    } catch (e) {
      console.error("[Bulk Delete Error]", e);
      toast.error(e.response?.data?.message || "Failed to delete selected questions.");
    } finally {
      // Clear deleting status
      setDeletingIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const save = async form => {
    if (!form.subject?.trim() || !form.class_name?.trim() || !form.question_text?.trim()) {
      toast.error("Subject, class, and question text are required.");
      return;
    }
    if (form.type === "mcq" && (!form.option_a?.trim() || !form.option_b?.trim() || !form.option_c?.trim() || !form.option_d?.trim())) {
      toast.error("All options are required for multiple choice questions.");
      return;
    }
    if (form.type === "fib" && !form.answer?.trim()) {
      toast.error("Correct answer is required for fill-in-the-blanks.");
      return;
    }

    setImporting(true); // Reuse importing state for single save feedback
    try {
      if (modal === "add") {
        const res = await api.createQuestion(form);
        setQuestions(qs => [res.data, ...qs]);
        toast.success("Question added.");
      } else {
        const res = await api.updateQuestion(modal.id, form);
        setQuestions(qs => qs.map(q => q.id === modal.id ? res.data : q));
        toast.success("Question updated.");
      }
      setModal(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save question.");
    } finally {
      setImporting(false);
    }
  };

  const del = async id => {
    if (!confirm("Delete this question?")) return;
    
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await api.deleteQuestion(Number(id));
      setQuestions(qs => qs.filter(q => q.id !== id));
      toast.success("Deleted.");
    } catch (e) {
      console.error("[Delete Question Error]", e);
      toast.error(e.response?.data?.message || "Failed to delete question.");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkImport = async newQs => {
    setImporting(true);
    setImportProgress(0);
    try {
      const payloads = newQs.map(q => {
        const type = (q.type || 'mcq').toLowerCase();
        return {
          subject: q.subject,
          class_name: q.className,
          type: type,
          question_text: q.text,
          option_a: type === 'mcq' ? (q.options ? q.options[0] : null) : (type === 'boolean' ? 'True' : null),
          option_b: type === 'mcq' ? (q.options ? q.options[1] : null) : (type === 'boolean' ? 'False' : null),
          option_c: type === 'mcq' ? (q.options ? q.options[2] : null) : null,
          option_d: type === 'mcq' ? (q.options ? q.options[3] : null) : null,
          correct_option: type === 'mcq' ? (['A', 'B', 'C', 'D'][q.correct] || q.correct_option || 'A') : (type === 'boolean' ? (q.answerBool ? 'A' : (q.answer === 'true' ? 'A' : 'B')) : null),
          answer: type === 'fib' ? (q.answer || q.correct_answer) : null,
          answerBool: type === 'boolean' ? (q.answerBool ?? (q.answer === 'true' || q.correct_answer === 'true')) : null,
        };
      });

      const chunkSize = 100;
      const chunks = [];
      for (let i = 0; i < payloads.length; i += chunkSize) {
        chunks.push(payloads.slice(i, i + chunkSize));
      }

      const allCreated = [];
      for (let i = 0; i < chunks.length; i++) {
        const res = await api.bulkCreateQuestions(chunks[i]);
        allCreated.push(...res.data);
        setImportProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      setQuestions(qs => [...allCreated, ...qs]);
      toast.success(`${allCreated.length} questions imported successfully!`);
      setShowBulk(false);
    } catch (e) {
      console.error("[Bulk Import Error]", e);
      const msg = e.response?.data?.message || "Failed to bulk import some questions. Ensure all required fields are present.";
      toast.error(msg);
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>Question Bank</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...btnGhost, border: "1.5px solid #cbd5e1" }} onClick={() => setShowBulk(true)}>⬆ Bulk Upload</button>
          <button style={btnPrimary} onClick={() => setModal("add")}>+ Add Question</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <select style={inputStyle} value={filters.subject} onChange={e => handleFilterChange("subject", e.target.value)} disabled={deletingIds.size > 0 || importing}>
          <option value="all">All Subjects</option>
          {[...new Set(questions.map(q => q.subject).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={inputStyle} value={filters.class} onChange={e => handleFilterChange("class", e.target.value)} disabled={deletingIds.size > 0 || importing}>
          <option value="all">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selected.length > 0 && (
          <button 
            style={{...btnDanger, opacity: (deletingIds.size > 0 || importing) ? 0.6 : 1}} 
            onClick={deleteSelected} 
            disabled={deletingIds.size > 0 || importing}
          >
            {deletingIds.size > 0 ? "Deleting..." : `Delete Selected (${selected.length})`}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", gap: 16, background: "#f1f5f9", borderRadius: 6 }}>
          <input type="checkbox" checked={selected.length === questions.length && questions.length > 0} onChange={toggleSelectAll} disabled={deletingIds.size > 0 || importing} />
          <span>{selected.length} selected</span>
        </div>
        {questions.map((q, i) => {
          const isDeleting = deletingIds.has(q.id);
          return (
            <div key={q.id} style={{ 
              background: "#fff", 
              borderRadius: 10, 
              padding: "16px 20px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)", 
              display: "flex", 
              alignItems: "center", 
              gap: 16,
              opacity: isDeleting ? 0.5 : 1,
              transition: "opacity 0.2s"
            }}>
              <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggleSelect(q.id)} disabled={isDeleting || importing} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{i + 1}. {q.question_text}</p>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, background: "#e0f2fe", color: "#0ea5e9", padding: "2px 8px", borderRadius: 12 }}>{q.subject}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, background: "#f0fdf4", color: "#22c55e", padding: "2px 8px", borderRadius: 12 }}>{q.class_name}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {['a', 'b', 'c', 'd'].map((opt) => (
                        <span key={opt} style={{ fontSize: 13, color: q.correct_option === opt.toUpperCase() ? "#16a34a" : "#64748b", background: q.correct_option === opt.toUpperCase() ? "#dcfce7" : "#f8fafc", padding: "4px 10px", borderRadius: 6 }}>
                          {q.correct_option === opt.toUpperCase() ? "✓ " : ""}{opt.toUpperCase()}. {q[`option_${opt}`]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button style={btnGhost} onClick={() => setModal(q)} disabled={isDeleting || importing}>Edit</button>
                    <button 
                      style={{...btnDanger, padding: "6px 12px", fontSize: 13}} 
                      onClick={() => del(q.id)} 
                      disabled={isDeleting || importing}
                    >
                      {isDeleting ? "..." : "Del"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {questions.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No questions found.</div>}
      </div>
      {modal && (
        <Modal title={modal === "add" ? "Add Question" : "Edit Question"} onClose={() => setModal(null)}>
          <QuestionForm initial={modal === "add" ? null : modal} onSave={save} onClose={() => setModal(null)} loading={importing} />
        </Modal>
      )}
      {showBulk && (
        <BulkUploadModal 
          onClose={() => setShowBulk(false)} 
          onImport={handleBulkImport} 
          toast={toast} 
          importing={importing} 
          importProgress={importProgress}
        />
      )}
    </div>
  );
}

// ── EXAM MANAGEMENT ────────────────────────────────────────────────────────────
function ExamManagement({ exams, setExams, questions, results, toast }) {
  const [modal, setModal] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const save = async form => {
    if (!form.title?.trim() || !form.subject?.trim() || !form.class_name?.trim()) { 
      toast.error("Exam title, subject, and class are required."); 
      return; 
    }
    if (form.question_ids.length === 0) { toast.error("Select at least one question."); return; }
    
    const payload = {
      ...form,
      title: form.title.trim(),
      subject: form.subject.trim(),
      class_name: form.class_name.trim(),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    
    setSaving(true);
    try {
      let savedExam;
      if (modal === "add") {
        const res = await api.createExam(payload);
        savedExam = res.data;
        // Also assign questions if any
        if (form.question_ids.length > 0) {
          await api.assignExamQuestions(savedExam.id, form.question_ids.map((id, i) => ({ question_id: Number(id), sort_order: i })));
        }
        setExams(es => [...es, { ...savedExam, question_ids: form.question_ids }]);
        toast.success("Exam created.");
      } else {
        const res = await api.updateExam(modal.id, payload);
        savedExam = res.data;
        // Re-assign questions
        await api.assignExamQuestions(savedExam.id, form.question_ids.map((id, i) => ({ question_id: Number(id), sort_order: i })));
        setExams(es => es.map(e => e.id === modal.id ? { ...savedExam, question_ids: form.question_ids } : e));
        toast.success("Exam updated.");
      }
      setModal(null);
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to save exam.");
    } finally {
      setSaving(false);
    }
  };

  const del = async id => {
    if (!confirm("Delete this exam?")) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await api.deleteExam(id);
      setExams(es => es.filter(e => e.id !== id));
      toast.success("Deleted.");
    } catch {
      toast.error("Failed to delete exam.");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggle = async id => {
    const ex = exams.find(e => e.id === id);
    if (!ex) return;
    try {
      const res = await api.updateExam(id, { is_active: !ex.is_active });
      setExams(es => es.map(e => e.id === id ? { ...e, is_active: res.data.is_active } : e));
    } catch {
      toast.error("Failed to toggle exam.");
    }
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#0f172a"}}>Exam Management</h1>
        <button style={btnPrimary} onClick={()=>setModal("add")} disabled={saving}>+ Create Exam</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {exams.map(e => {
          const subResults = results.filter(r=>r.examId===e.id);
          const isDeleting = deletingIds.has(e.id);
          return (
            <div key={e.id} style={{ 
              background: "#fff", 
              borderRadius: 10, 
              padding: "18px 22px", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              opacity: isDeleting ? 0.5 : 1,
              transition: "opacity 0.2s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{e.title}</span>
                    <Badge color={e.is_active ? "green" : "gray"}>{e.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b", flexWrap: "wrap" }}>
                    <span>⏱ {e.duration_minutes} mins</span>
                    <span>❓ {e.question_ids?.length || 0} questions</span>
                    <span>📊 {subResults.length} submissions</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  <button style={btnGhost} onClick={() => toggle(e.id)} disabled={isDeleting || saving}>{e.is_active ? "Deactivate" : "Activate"}</button>
                  <button style={btnGhost} onClick={() => setModal(e)} disabled={isDeleting || saving}>Edit</button>
                  <button style={btnDanger} onClick={() => del(e.id)} disabled={isDeleting || saving}>{isDeleting ? "..." : "Delete"}</button>
                </div>
              </div>
            </div>
          );
        })}
        {exams.length===0 && <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No exams created yet.</div>}
      </div>
      {modal && (
        <Modal title={modal==="add"?"Create Exam":"Edit Exam"} onClose={()=>setModal(null)} wide>
          <ExamForm initial={modal==="add"?null:modal} questions={questions} onSave={save} onClose={()=>setModal(null)} loading={saving} />
        </Modal>
      )}
    </div>
  );
}

// ── RESULTS MANAGEMENT ────────────────────────────────────────────────────────
function ResultsManagement({ results, students, exams, questions }) {
  const [filterClass, setFilterClass] = useState("All");
  const [filterExam, setFilterExam] = useState("All");
  const [viewResult, setViewResult] = useState(null);
  const [backendResults, setBackendResults] = useState([]);
  const [fetchError, setFetchError] = useState("");
  useEffect(() => {
    api.listResults().then(r => {
      const rows = (r.data || []).map(x => ({
        id: x.id,
        studentId: String(x.student_id),
        examId: String(x.exam_id),
        score: x.score,
        total: x.total_questions,
        submittedAt: x.submitted_at || x.created_at,
        answers: (x.answers || []).reduce((acc, a) => {
          acc[a.question_id] = a.selected_option.toUpperCase();
          return acc;
        }, {}),
      }));
      setBackendResults(rows);
      setFetchError("");
    }).catch(() => setFetchError("Failed to fetch results from backend"));
  }, []);

  const source = backendResults.length ? backendResults : results;
  const filtered = source.filter(r => {
    const s = students.find(x=>x.id===r.studentId);
    const e = exams.find(x=>x.id===r.examId);
    return (filterClass==="All" || s?.className===filterClass) && (filterExam==="All" || r.examId===filterExam);
  });

  const exportCSV = () => {
    const rows = [["Student","Reg Number","Class","Exam","Score","Total","Percent","Submitted"]];
    filtered.forEach(r => {
      const s = students.find(x=>x.id===r.studentId);
      const e = exams.find(x=>x.id===r.examId);
      rows.push([s?.fullName||"",s?.regNumber||"",s?.className||"",e?.title||"",r.score,r.total,Math.round(r.score/r.total*100)+"%",r.submittedAt]);
    });
    const csv = rows.map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "all_results.csv";
    a.click();
  };

  const deleteResult = async (id) => {
    if (!confirm("Are you sure you want to delete this result? This action cannot be undone.")) return;
    try {
      await api.deleteResult(id);
      setBackendResults(prev => prev.filter(r => r.id !== id));
      toast.success("Result deleted successfully.");
    } catch (e) {
      toast.error("Failed to delete result.");
    }
  };

  const downloadResult = (r, format = "json") => {
     const s = students.find(x => x.id === r.studentId);
     const e = exams.find(x => x.id === r.examId);
     const pct = Math.round(r.score / r.total * 100);
     
     const data = {
       id: r.id,
       student: {
         name: s?.fullName,
         regNumber: s?.regNumber,
         class: s?.className
       },
       exam: {
         title: e?.title,
         subject: e?.subject
       },
       score: r.score,
       total: r.total,
       percentage: pct,
       submittedAt: r.submittedAt,
       answers: Object.entries(r.answers || {}).map(([qid, ans]) => {
         const q = questions.find(x => x.id === qid);
         return {
           question: q?.question_text || q?.text,
           givenAnswer: ans,
           correctAnswer: q?.correct_option || (q?.options && q.options[q.correct])
         };
       })
     };

     let blob, extension;
     if (format === "json") {
       blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
       extension = "json";
     } else if (format === "csv") {
       const rows = [
         ["Field", "Value"],
         ["Student Name", s?.fullName],
         ["Reg Number", s?.regNumber],
         ["Class", s?.className],
         ["Exam Title", e?.title],
         ["Subject", e?.subject],
         ["Score", `${r.score}/${r.total}`],
         ["Percentage", `${pct}%`],
         ["Submitted At", new Date(r.submittedAt).toLocaleString()],
         [],
         ["#", "Question", "Given Answer", "Correct Answer", "Result"]
       ];
       data.answers.forEach((a, i) => {
         rows.push([i + 1, a.question, a.givenAnswer, a.correctAnswer, a.givenAnswer === a.correctAnswer ? "Correct" : "Incorrect"]);
       });
       const csvContent = rows.map(row => row.map(cell => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
       blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
       extension = "csv";
     }

     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `result_${s?.regNumber || "unknown"}_${r.id}.${extension}`;
     a.click();
     URL.revokeObjectURL(url);
   };

  const printResult = (r) => {
    setViewResult(r);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #modal-root, #modal-root * { visibility: visible; }
          #modal-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div id="modal-root"></div>
      <div className="no-print">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h1 style={{fontSize:22,fontWeight:800,margin:0,color:"#0f172a"}}>Result Management</h1>
          <button style={btnPrimary} onClick={exportCSV}>⬇ Export CSV</button>
        </div>
        {fetchError && <div style={{marginBottom:12,background:"#fef2f2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13}}>{fetchError}</div>}
        <div style={{display:"flex",gap:12,marginBottom:16}}>
          <select style={{...inputStyle,maxWidth:160}} value={filterClass} onChange={e=>setFilterClass(e.target.value)}>
            <option value="All">All Classes</option>
            {CLASSES.map(c=><option key={c}>{c}</option>)}
          </select>
          <select style={{...inputStyle,maxWidth:220}} value={filterExam} onChange={e=>setFilterExam(e.target.value)}>
            <option value="All">All Exams</option>
            {exams.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <div style={{background:"#fff",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#f8fafc"}}>
                {["Student","Reg Number","Class","Exam","Score","Status","Date","Actions"].map(h=>(
                  <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const s = students.find(x=>x.id===r.studentId);
                const e = exams.find(x=>x.id===r.examId);
                const pct = Math.round(r.score/r.total*100);
                return (
                  <tr key={r.id} style={{borderTop:"1px solid #f1f5f9"}}>
                    <td style={{padding:"12px 16px",fontSize:14,fontWeight:600}}>{s?.fullName||"Unknown"}</td>
                    <td style={{padding:"12px 16px",fontSize:13,color:"#1d4ed8"}}>{s?.regNumber||"—"}</td>
                    <td style={{padding:"12px 16px"}}><Badge>{s?.className||"?"}</Badge></td>
                    <td style={{padding:"12px 16px",fontSize:13}}>{e?.title||"Unknown"}</td>
                    <td style={{padding:"12px 16px",fontSize:14,fontWeight:700}}>{r.score}/{r.total} <span style={{fontWeight:400,color:"#64748b"}}>({pct}%)</span></td>
                    <td style={{padding:"12px 16px"}}><Badge color={pct>=50?"green":"red"}>{pct>=50?"Pass":"Fail"}</Badge></td>
                    <td style={{padding:"12px 16px",fontSize:12,color:"#64748b"}}>{new Date(r.submittedAt).toLocaleDateString()}</td>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button title="View" style={{...btnGhost, padding: "4px 8px"}} onClick={()=>setViewResult(r)}>👁️</button>
                        <button title="Download" style={{...btnGhost, padding: "4px 8px"}} onClick={()=>downloadResult(r)}>📥</button>
                        <button title="Print" style={{...btnGhost, padding: "4px 8px"}} onClick={()=>printResult(r)}>🖨️</button>
                        <button title="Delete" style={{...btnDanger, padding: "4px 8px"}} onClick={()=>deleteResult(r.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td colSpan={8} style={{padding:32,textAlign:"center",color:"#94a3b8"}}>No results found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {viewResult && (() => {
        const s = students.find(x=>x.id===viewResult.studentId);
        const e = exams.find(x=>x.id===viewResult.examId);
        return (
          <Modal title="Result Detail" onClose={()=>setViewResult(null)} wide>
            <div id="print-area">
              <div style={{marginBottom:16,padding:16,background:"#f8fafc",borderRadius:8, border: "1px solid #e2e8f0"}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
                  <div>
                    <h3 style={{margin: "0 0 10px", color: "#0f172a"}}>Individual Performance Report</h3>
                    <p style={{margin:"4px 0",fontSize:14}}><strong>Student:</strong> {s?.fullName} ({s?.regNumber})</p>
                    <p style={{margin:"4px 0",fontSize:14}}><strong>Class:</strong> {s?.className}</p>
                    <p style={{margin:"4px 0",fontSize:14}}><strong>Exam:</strong> {e?.title} ({e?.subject})</p>
                  </div>
                  <div style={{textAlign: "right"}}>
                    <div style={{fontSize: 24, fontWeight: 800, color: viewResult.score/viewResult.total >= 0.5 ? "#16a34a" : "#dc2626"}}>
                      {Math.round(viewResult.score/viewResult.total*100)}%
                    </div>
                    <p style={{margin:0, fontSize: 12, color: "#64748b"}}>Score: {viewResult.score} / {viewResult.total}</p>
                    <p style={{margin:0, fontSize: 12, color: "#64748b"}}>{new Date(viewResult.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {e?.questionIds?.map((qid,i) => {
                  const q = questions.find(x=>x.id===qid);
                  if (!q) return null;
                  const given = viewResult.answers ? viewResult.answers[qid] : null;
                  const correct = q.correct_option || (q.options && q.options[q.correct]);
                  
                  // Handle different question formats (backend uses correct_option string, frontend might use correct index)
                  const isCorrect = given === correct;
                  
                  return (
                    <div key={qid} style={{padding:16,borderRadius:10,background:isCorrect?"#f0fdf4":"#fef2f2",border:`1px solid ${isCorrect?"#bbf7d0":"#fecaca"}`}}>
                      <p style={{margin:"0 0 10px",fontSize:14,fontWeight:600,color: "#1e293b"}}>{i+1}. {q.question_text || q.text}</p>
                      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10}}>
                        <div style={{fontSize:13}}>
                          <span style={{color: "#64748b"}}>Student's Choice:</span><br/>
                          <strong style={{color:isCorrect?"#16a34a":"#dc2626"}}>{given || "Not answered"}</strong>
                        </div>
                        {!isCorrect && (
                          <div style={{fontSize:13}}>
                            <span style={{color: "#64748b"}}>Correct Answer:</span><br/>
                            <strong style={{color:"#16a34a"}}>{correct}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="no-print" style={{display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24}}>
                <button style={btnGhost} onClick={() => printResult(viewResult)}>🖨️ Print Report</button>
                <div style={{position: "relative", display: "inline-block"}}>
                  <button style={btnPrimary} onClick={(e) => {
                    const menu = e.currentTarget.nextSibling;
                    menu.style.display = menu.style.display === "none" ? "block" : "none";
                  }}>📥 Download Result</button>
                  <div style={{display: "none", position: "absolute", bottom: "100%", right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 120, marginBottom: 8}}>
                    <button style={{width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9"}} onClick={() => downloadResult(viewResult, "json")}>JSON Format</button>
                    <button style={{width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13}} onClick={() => downloadResult(viewResult, "csv")}>CSV Format</button>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
function LiveMonitor({ students, exams }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterExam, setFilterExam] = useState("All");
  const [tick, setTick] = useState(0);           // forces re-render for elapsed times
 
  // Poll backend every 5 seconds
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await api.listActiveSessions();
        const now = new Date();
        
        // Map backend sessions to frontend format
        const mapped = res.data.map(s => {
          const startTime = new Date(s.start_time);
          const durationSeconds = (s.exam?.duration_minutes || 30) * 60;
          const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          const timeLeft = Math.max(0, durationSeconds - elapsedSeconds);
          const answeredCount = Object.keys(s.answers_provided || {}).length;
          const totalQuestions = (s.exam?.question_ids || []).length || 1; // fallback to 1 to avoid div by 0

          return {
            studentId: s.student_id,
            studentName: s.student?.name || "Unknown",
            regNumber: s.student?.registration_number || "N/A",
            className: s.student?.class_name || "N/A",
            examId: s.exam_id,
            examTitle: s.exam?.title || "Unknown Exam",
            timeLeft: timeLeft,
            totalTime: durationSeconds,
            answered: answeredCount,
            total: totalQuestions,
            currentQuestion: (s.current_question_index || 0) + 1,
            lastSeen: new Date(s.last_synced_at || s.updated_at).getTime(),
            startedAt: startTime.getTime(),
          };
        });

        setSessions(mapped);
        setLoading(false);
        setTick(t => t + 1);
      } catch (e) {
        console.error("Failed to fetch live sessions", e);
      }
    };

    fetchSessions();
    const id = setInterval(fetchSessions, 5000);
    return () => clearInterval(id);
  }, []);
 
  const sessionList = sessions;
  const activeExamIds = [...new Set(sessionList.map(s => s.examId))];
  const filtered = filterExam === "All" ? sessionList : sessionList.filter(s => s.examId === filterExam);
 
  // Sort: most urgent (least time) first
  filtered.sort((a, b) => a.timeLeft - b.timeLeft);
 
  const urgentCount = sessionList.filter(s => s.timeLeft < 120).length;
  const now = Date.now();
 
  return (
    <div>
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
        @keyframes fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .live-card { animation: fade-in 0.3s ease; transition: box-shadow 0.2s; }
        .live-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.12) !important; }
      `}</style>
 
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: "#0f172a" }}>
            Live Exam Monitor
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Updates every 5 seconds · Showing students currently taking exams
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: sessionList.length > 0 ? "#f0fdf4" : "#f8fafc", border: `1px solid ${sessionList.length > 0 ? "#86efac" : "#e2e8f0"}`, borderRadius: 20, padding: "6px 14px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: sessionList.length > 0 ? "#16a34a" : "#94a3b8", display: "inline-block", animation: sessionList.length > 0 ? "pulse-dot 1.5s ease infinite" : "none" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: sessionList.length > 0 ? "#16a34a" : "#94a3b8" }}>
              {loading ? "Loading..." : (sessionList.length > 0 ? `${sessionList.length} Active` : "No active sessions")}
            </span>
          </div>
          {urgentCount > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#dc2626" }}>{urgentCount} under 2 min</span>
            </div>
          )}
        </div>
      </div>
 
      {/* Summary stats */}
      {sessionList.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { icon: "🟢", label: "Active Students", value: sessionList.length, bg: "#f0fdf4", fg: "#16a34a" },
            { icon: "📋", label: "Exams Running", value: activeExamIds.length, bg: "#eff6ff", fg: "#1d4ed8" },
            { icon: "⚠️", label: "Low Time (<2m)", value: urgentCount, bg: urgentCount > 0 ? "#fef2f2" : "#f8fafc", fg: urgentCount > 0 ? "#dc2626" : "#64748b" },
            { icon: "✏️", label: "Avg Progress", value: sessionList.length ? `${Math.round(sessionList.reduce((a, s) => a + (s.answered / s.total) * 100, 0) / sessionList.length)}%` : "—", bg: "#fefce8", fg: "#ca8a04" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "14px 18px", border: `1px solid ${s.bg}` }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.fg }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
 
      {/* Filter */}
      {sessionList.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
          <select
            style={{ ...inputStyle, maxWidth: 240 }}
            value={filterExam}
            onChange={e => setFilterExam(e.target.value)}
          >
            <option value="All">All Exams ({sessionList.length} students)</option>
            {activeExamIds.map(id => {
              const exam = exams.find(ex => ex.id === id);
              const count = sessionList.filter(s => s.examId === id).length;
              return <option key={id} value={id}>{exam?.title || id} ({count})</option>;
            })}
          </select>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Showing {filtered.length} student{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
 
      {/* Empty state */}
      {!loading && sessionList.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "60px 40px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>👀</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>No Students Taking Exams</h3>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            When students start an exam, their live progress will appear here automatically.
          </p>
        </div>
      )}
 
      {/* Student cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
        {filtered.map(s => {
          const progressPct = Math.round((s.answered / s.total) * 100);
          const timePct = Math.round((s.timeLeft / s.totalTime) * 100);
          const urgent = s.timeLeft < 120;
          const warning = s.timeLeft < 300;
          const elapsedSec = Math.round((now - s.startedAt) / 1000);
          const elapsedStr = elapsedSec < 60
            ? `${elapsedSec}s ago`
            : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;
          const heartbeatAge = Math.round((now - s.lastSeen) / 1000);
 
          const timeColor = urgent ? "#dc2626" : warning ? "#ca8a04" : "#16a34a";
          const timeBg = urgent ? "#fef2f2" : warning ? "#fefce8" : "#f0fdf4";
 
          return (
            <div
              key={s.studentId}
              className="live-card"
              style={{
                background: "#fff",
                borderRadius: 14,
                padding: 20,
                boxShadow: urgent
                  ? "0 0 0 2px #fca5a5, 0 4px 16px rgba(220,38,38,0.1)"
                  : "0 2px 8px rgba(0,0,0,0.06)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Urgency stripe */}
              {urgent && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#dc2626,#f87171)", borderRadius: "14px 14px 0 0" }} />
              )}
 
              {/* Top row: name + live dot */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>{s.studentName}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{s.regNumber} · {s.className}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: heartbeatAge < 15 ? "#16a34a" : "#f59e0b", display: "inline-block", animation: "pulse-dot 1.5s ease infinite" }} />
                    <span style={{ fontSize: 11, color: "#64748b" }}>{heartbeatAge < 15 ? "Live" : `${heartbeatAge}s ago`}</span>
                  </div>
                  {urgent && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fef2f2", borderRadius: 10, padding: "2px 8px" }}>⚠ LOW TIME</span>
                  )}
                </div>
              </div>
 
              {/* Exam name */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1d4ed8", marginBottom: 14, padding: "6px 10px", background: "#eff6ff", borderRadius: 6 }}>
                📋 {s.examTitle}
              </div>
 
              {/* Time remaining */}
              <div style={{ background: timeBg, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Time Remaining</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: timeColor, fontVariantNumeric: "tabular-nums" }}>{fmt(s.timeLeft)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Elapsed</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{elapsedStr}</div>
                </div>
              </div>
 
              {/* Time progress bar */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                  <span>Time used</span>
                  <span>{Math.max(0, 100 - timePct)}% elapsed</span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(0, 100 - timePct)}%`, background: `linear-gradient(90deg,${timeColor},${urgent ? "#f87171" : warning ? "#fbbf24" : "#4ade80"})`, borderRadius: 6, transition: "width 0.5s" }} />
                </div>
              </div>
 
              {/* Questions progress */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                  <span>Questions answered</span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{s.answered} / {s.total}</span>
                </div>
                <div style={{ height: 8, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#3b82f6,#60a5fa)", borderRadius: 6, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
                  <span style={{ color: "#16a34a", fontWeight: 600 }}>{progressPct}% done</span>
                  <span style={{ color: "#94a3b8" }}>Q{s.currentQuestion} current</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function AdminPanel({ onLogout, data, setData, toast }) {
  const [section, setSection] = useState("dashboard");
  const { students, exams, results, questions, users = [] } = data;
  const setStudents = fn => setData(d => ({ ...d, students: typeof fn === "function" ? fn(d.students || []) : fn }));
  const setExams = fn => setData(d => ({ ...d, exams: typeof fn === "function" ? fn(d.exams || []) : fn }));
  const setResults = fn => setData(d => ({ ...d, results: typeof fn === "function" ? fn(d.results || []) : fn }));
  const setQuestions = fn => setData(d => ({ ...d, questions: typeof fn === "function" ? fn(d.questions || []) : fn }));
  const setUsers = fn => setData(d => ({ ...d, users: typeof fn === "function" ? fn(d.users || []) : fn }));
  const [warnOpen, setWarnOpen] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const idleRef = useRef(Date.now());
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null);

  useEffect(() => {
    const update = () => {
      idleRef.current = Date.now();
      if (warnOpen) {
        setWarnOpen(false);
        clearInterval(warnTimerRef.current);
        setCountdown(30);
      }
      localStorage.setItem('admin_idle_sync', JSON.stringify({ t: Date.now(), action: 'reset' }));
    };

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, update));

    timerRef.current = setInterval(() => {
      const diff = Date.now() - idleRef.current;
      // 2.5 minutes (150s) idle triggers a 30s warning = 3 minutes total
      if (diff >= 150 * 1000 && !warnOpen) {
        setWarnOpen(true);
        setCountdown(30);
        localStorage.setItem('admin_idle_sync', JSON.stringify({ t: Date.now(), action: 'warning' }));
        
        warnTimerRef.current = setInterval(() => {
          setCountdown(c => {
            if (c <= 1) {
              clearInterval(warnTimerRef.current);
              localStorage.setItem('admin_idle_sync', JSON.stringify({ t: Date.now(), action: 'logout' }));
              try { localStorage.setItem('expired_message', 'Your session has expired due to inactivity.'); } catch {}
              try { setTokens(null); } catch {}
              try {
                localStorage.removeItem('auth_admin');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
              } catch {}
              onLogout();
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      }
    }, 1000);
    const onStorage = e => {
      if (e.key === 'admin_idle_sync' && e.newValue) {
        const payload = JSON.parse(e.newValue);
        if (payload.action === 'reset') {
          idleRef.current = Date.now();
          if (warnOpen) { setWarnOpen(false); clearInterval(warnTimerRef.current); setCountdown(30); }
        } else if (payload.action === 'warning') {
          idleRef.current = Date.now() - 3 * 60 * 1000;
          setWarnOpen(true);
          setCountdown(30);
          clearInterval(warnTimerRef.current);
          warnTimerRef.current = setInterval(() => {
            setCountdown(c => {
              if (c <= 1) {
                clearInterval(warnTimerRef.current);
                try { localStorage.setItem('expired_message', 'Your session has expired due to inactivity.'); } catch {}
                try { setTokens(null); } catch {}
                try { localStorage.removeItem('auth_admin'); localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); } catch {}
                onLogout();
                return 0;
              }
              return c - 1;
            });
          }, 1000);
        } else if (payload.action === 'logout') {
          try { localStorage.setItem('expired_message', 'Your session has expired due to inactivity.'); } catch {}
          try { setTokens(null); } catch {}
          try { localStorage.removeItem('auth_admin'); localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); } catch {}
          onLogout();
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      events.forEach(e => window.removeEventListener(e, update));
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
      window.removeEventListener('storage', onStorage);
    };
  }, [warnOpen, onLogout]);

  const navItems = [
    {id:"dashboard",icon:"🏠",label:"Dashboard"},
    {id:"students",icon:"👥",label:"Students"},
    {id:"questions",icon:"❓",label:"Questions"},
    {id:"exams",icon:"📋",label:"Exams"},
    {id:"results",icon:"📊",label:"Results"},
    { id: "monitor",   icon: "📡", label: "Live Monitor" },
    {id:"users",icon:"🧑‍💼",label:"Users"},
    {id:"system",icon:"⚙️",label:"System Control",superOnly:true},
  ];

  const visibleNav = navItems.filter(i => !i.superOnly || data.adminRole === "super_admin");

  return (
    <div style={{display:"flex",height:"100vh",background:"#f1f5f9",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:220,background:"#0f172a",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px",borderBottom:"1px solid #1e293b"}}>
          <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:"-0.02em"}}>CBT Portal</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Admin Panel</div>
        </div>
        <nav style={{flex:1,padding:"12px 0"}}>
          {visibleNav.map(item => (
            <button key={item.id} onClick={()=>setSection(item.id)} style={{
              width:"100%",textAlign:"left",padding:"12px 20px",border:"none",cursor:"pointer",
              background:section===item.id?"#1e3a5f":"transparent",
              color:section===item.id?"#60a5fa":"#94a3b8",
              fontSize:14,fontWeight:section===item.id?600:400,
              display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"
            }}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div style={{padding:16}}>
          <button onClick={onLogout} style={{...btnGhost,width:"100%",background:"#1e293b",color:"#94a3b8"}}>← Logout</button>
        </div>
      </div>

      {/* Main */}
      <ErrorBoundary>
        <div style={{flex:1,overflowY:"auto",padding:32}}>
        {section==="dashboard" && <Dashboard students={students} exams={exams} results={results} questions={questions}/>}
        {section==="students" && <StudentManagement students={students} setStudents={setStudents} toast={toast}/>}
        {section==="questions" && <QuestionManagement questions={questions} setQuestions={setQuestions} toast={toast}/>}
        {section==="exams" && <ExamManagement exams={exams} setExams={setExams} questions={questions} results={results} toast={toast}/>}
        {section==="results" && <ResultsManagement results={results} students={students} exams={exams} questions={questions}/>}
        {section==="monitor" && <LiveMonitor students={students} exams={exams}/>}
        {section==="users" && <UserManagement users={users} setUsers={setUsers} toast={toast}/>}
        {section==="system" && data.adminRole === "super_admin" && <SystemControl toast={toast}/>}
        {!["dashboard","students","questions","exams","results","monitor","users","system"].includes(section) && (
          <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",textAlign:"center",color:"#64748b"}}>No section selected</div>
        )}
        {warnOpen && (
          <Modal title="Session Inactivity Warning" onClose={()=>{ setWarnOpen(false); setCountdown(30); idleRef.current = Date.now(); localStorage.setItem('admin_idle_sync', JSON.stringify({ t: Date.now(), action: 'reset' })); }}>
            <p style={{fontSize:14,color:"#64748b"}}>No activity detected. You will be logged out in {countdown} seconds.</p>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12}}>
              <button style={btnGhost} onClick={()=>{ setWarnOpen(false); setCountdown(30); idleRef.current = Date.now(); localStorage.setItem('admin_idle_sync', JSON.stringify({ t: Date.now(), action: 'reset' })); }}>Continue Session</button>
              <button style={btnDanger} onClick={()=>{ localStorage.setItem('admin_idle_sync', JSON.stringify({ t: Date.now(), action: 'logout' })); try { localStorage.setItem('expired_message', 'You have been logged out.'); } catch {} try { setTokens(null, null); } catch {} try { localStorage.removeItem('auth_admin'); localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token'); } catch {} onLogout(); }}>Logout Now</button>
            </div>
          </Modal>
        )}
        </div>
      </ErrorBoundary>
    </div>
  );
}

// ── SYSTEM CONTROL ────────────────────────────────────────────────────────────
function SystemControl({ toast }) {
  const [loading, setLoading] = useState(true);
  const [globalActive, setGlobalActive] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!scheduledAt) {
      setTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      const target = new Date(scheduledAt).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(timer);
        // Automatically trigger deactivation if we were active
        if (globalActive) {
          handleAutoDeactivate();
        }
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [scheduledAt, globalActive]);

  const handleAutoDeactivate = async () => {
    // Silently deactivate without confirm since it's scheduled
    setSaving(true);
    try {
      await api.toggleGlobalStatus(false);
      setGlobalActive(false);
      setScheduledAt(""); // Clear after trigger
      await api.updateSystemSettings({ scheduled_shutdown: null });
      toast.info("Scheduled shutdown: All accounts have been deactivated.");
    } catch {
      toast.error("Scheduled deactivation failed.");
    } finally {
      setSaving(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.getSystemSettings();
      setGlobalActive(res.global_active);
      if (res.settings.scheduled_shutdown) {
        // Convert to datetime-local format
        const d = new Date(res.settings.scheduled_shutdown);
        const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setScheduledAt(iso);
      }
    } catch {
      toast.error("Failed to load system settings.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGlobal = async () => {
    if (!confirm(`Are you sure you want to ${globalActive ? 'DEACTIVATE' : 'ACTIVATE'} all accounts? This will affect all students and admins.`)) return;
    setSaving(true);
    try {
      await api.toggleGlobalStatus(!globalActive);
      setGlobalActive(!globalActive);
      toast.success(globalActive ? "All accounts deactivated." : "All accounts activated.");
    } catch (e) {
      const msg = e.response?.data?.message || e.message || "Failed to toggle global status.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const saveScheduled = async () => {
    if (!scheduledAt) return;
    setSaving(true);
    try {
      // The browser returns local time from <input type="datetime-local">
      // We send it as is, and the server (Laravel) handles it as its system timezone
      await api.updateSystemSettings({ scheduled_shutdown: scheduledAt });
      toast.success("Scheduled shutdown updated.");
    } catch {
      toast.error("Failed to update schedule.");
    } finally {
      setSaving(false);
    }
  };

  const clearScheduled = async () => {
    if (!confirm("Are you sure you want to clear the scheduled shutdown?")) return;
    setSaving(true);
    try {
      await api.updateSystemSettings({ scheduled_shutdown: null });
      setScheduledAt("");
      toast.success("Scheduled shutdown cleared.");
    } catch {
      toast.error("Failed to clear schedule.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{textAlign:"center",padding:40}}>Loading settings...</div>;

  return (
    <div style={{maxWidth:600}}>
      <h1 style={{fontSize:24,fontWeight:800,color:"#0f172a",marginBottom:24}}>System Control</h1>
      
      <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",marginBottom:24}}>
        <h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:700}}>Global Status</h3>
        <p style={{fontSize:14,color:"#64748b",marginBottom:20}}>
          Immediately enable or disable all student and regular admin accounts. 
          {globalActive ? " Currently all accounts are active." : " All accounts are currently disabled."}
        </p>
        <button 
          onClick={toggleGlobal} 
          disabled={saving}
          style={{
            ...btnPrimary, 
            background: globalActive ? "#dc2626" : "#16a34a",
            width: "100%",
            padding: "14px"
          }}
        >
          {saving ? "Processing..." : globalActive ? "Deactivate All Accounts" : "Activate All Accounts"}
        </button>
      </div>

      <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
        <h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:700}}>Scheduled Shutdown</h3>
        <p style={{fontSize:14,color:"#64748b",marginBottom:20}}>
          Pick a date and time to automatically deactivate all accounts.
        </p>
        
        {timeLeft !== null && globalActive && (
          <div style={{
            background: timeLeft < 60000 ? "#fef2f2" : "#f0f9ff",
            border: `1px solid ${timeLeft < 60000 ? "#fecaca" : "#bae6fd"}`,
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12
          }}>
            <span style={{fontSize:20}}>{timeLeft < 60000 ? "🚨" : "⏳"}</span>
            <div>
              <div style={{fontSize:12,color:timeLeft < 60000 ? "#991b1b" : "#0369a1",fontWeight:600,textTransform:"uppercase"}}>Countdown to Shutdown</div>
              <div style={{fontSize:18,fontWeight:800,color:timeLeft < 60000 ? "#dc2626" : "#0284c7",fontVariantNumeric:"tabular-nums"}}>
                {Math.floor(timeLeft / 3600000)}h {Math.floor((timeLeft % 3600000) / 60000)}m {Math.floor((timeLeft % 60000) / 1000)}s
              </div>
            </div>
          </div>
        )}

        <Field label="Shutdown Time">
          <input 
            type="datetime-local" 
            style={inputStyle} 
            value={scheduledAt} 
            onChange={e=>setScheduledAt(e.target.value)}
            disabled={saving}
          />
        </Field>
        <div style={{display:"flex",gap:12,marginTop:16}}>
          <button 
            type="button"
            style={{...btnGhost, flex:1}} 
            onClick={clearScheduled}
            disabled={saving || !scheduledAt}
          >
            Clear Schedule
          </button>
          <button 
            type="button"
            style={{...btnPrimary, flex:2}} 
            onClick={saveScheduled}
            disabled={saving}
          >
            {saving ? "Saving..." : "Set Shutdown Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExamInterface({ student, exam, questions, onSubmit }) {
  const ids = (Array.isArray(exam.question_ids) && exam.question_ids.length) ? exam.question_ids : (Array.isArray(questions) ? questions.map(q => q.id) : []);
  const [ordered, setOrdered] = useState(() => (exam.randomizeQuestions ? shuffle(ids) : ids.slice()));
  useEffect(() => {
    const nextOrder = exam.randomizeQuestions ? shuffle(ids) : ids.slice();
    setOrdered(nextOrder);
    // eslint-disable-next-line no-console
    console.log("[Exam order init]", { examId: exam.id, count: nextOrder.length });
  }, [exam.id, exam.randomizeQuestions, JSON.stringify(ids)]);
  const qs = ordered.map(id => questions.find(q => q.id === id)).filter(Boolean);
 
  const [answers, setAnswers] = useState(exam.initialAnswers || {});
  const [current, setCurrent] = useState(exam.initialIndex || 0);
  const timerKey = `exam_end_time_${student.id}_${exam.id}`;
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(timerKey);
    if (saved) {
      return Math.max(0, Math.floor((parseInt(saved) - Date.now()) / 1000));
    }
    return exam.remainingSeconds || (exam.duration_minutes || exam.duration || 30) * 60;
  });
  const endTimeRef = useRef(null);
  const timerRef = useRef(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitted = useRef(false);
  const [errorMsg, setErrorMsg] = useState("");
  const startedAt = useRef(Date.now()).current;

  // ── Incremental Saving (Heartbeat Sync) ───────────────────────────────────────
  const syncTimeoutRef = useRef(null);
  const lastSyncedAnswersRef = useRef(JSON.stringify(exam.initialAnswers || {}));

  const syncProgress = useCallback(async (currentAnswers, currentIndex) => {
    const answersStr = JSON.stringify(currentAnswers);
    if (answersStr === lastSyncedAnswersRef.current) return;

    try {
      await api.syncExamSession(Number(exam.id), {
        current_question_index: currentIndex,
        answers_provided: currentAnswers
      });
      lastSyncedAnswersRef.current = answersStr;
    } catch (e) {
      // Silently fail sync, will retry on next interaction
    }
  }, [exam.id]);

  useEffect(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    
    syncTimeoutRef.current = setTimeout(() => {
      syncProgress(answers, current);
    }, 2000); // 2 second debounce

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [answers, current, syncProgress]);

  // ── Live broadcast: fires whenever timeLeft / answers / current changes ───────
  useEffect(() => {
    broadcastSession({
      studentId: student.id,
      studentName: student.fullName,
      regNumber: student.regNumber,
      className: student.className,
      examId: exam.id,
      examTitle: exam.title,
      subject: exam.subject,
      timeLeft,
      totalTime: (exam.duration_minutes || exam.duration || 30) * 60,
      answered: Object.keys(answers).length,
      total: qs.length,
      currentQuestion: current + 1,
      startedAt,
    });
  }, [timeLeft, answers, current]);                             // intentionally omit stable refs
 
  // ── Clean up on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => clearSession(student.id);
  }, []);

  const doSubmit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setIsSubmitting(true);
    
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem(timerKey);

    try {
      clearSession(student.id);                                   // ← remove from live board
  
      let score = 0;
      qs.forEach(q => {
        const a = answers[q.id];
        if (!q.type || q.type === "mcq") {
          const correctIndex = q.correct_option ? (q.correct_option.charCodeAt(0) - 65) : q.correct;
          if (a === correctIndex) score++;
        } else if (q.type === "fib") {
          if ((q.answer || "").trim().toLowerCase() === (typeof a === "string" ? a.trim().toLowerCase() : "")) score++;
        } else if (q.type === "boolean") {
          const expected = q.answerBool === true ? "true" : "false";
          if ((typeof a === "string" ? a.trim().toLowerCase() : "") === expected) score++;
        }
      });
      await onSubmit({ score, total: qs.length, answers, questionIds: qs.map(q => q.id) });
    } catch (e) {
      console.error("[Submission Error]", e);
      submitted.current = false;
      setIsSubmitting(false);
      
      let msg = e.response?.data?.message || "Connection lost. Please try submitting again.";
      // If validation error, extract the first error message
      if (e.response?.status === 422 && e.response?.data?.errors) {
        const errs = e.response.data.errors;
        const first = Object.values(errs)[0];
        if (Array.isArray(first)) msg = first[0];
      }
      setErrorMsg(msg);
    }
  }, [answers, qs, onSubmit, student.id, timerKey]);

  useEffect(() => {
    // 1. Initialize endTime
    let endTime = localStorage.getItem(timerKey);
    if (!endTime) {
      const initialSeconds = exam.remainingSeconds || (exam.duration_minutes || exam.duration || 30) * 60;
      endTime = Date.now() + (initialSeconds * 1000);
      localStorage.setItem(timerKey, endTime.toString());
    } else {
      endTime = parseInt(endTime);
    }
    endTimeRef.current = endTime;

    // 2. Set up the timer
    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTimeRef.current - now) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        doSubmit();
      }
    };

    tick(); // Run immediately to set initial timeLeft
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerKey, exam.id, doSubmit]);
 
  const q = qs[current];
  const answered = Object.keys(answers).length;
  const pct = Math.round(answered / qs.length * 100);
  const urgent = timeLeft < 300; // < 5 mins
 
  const handleConfirmSubmit = () => {
    let hasBlank = false;
    qs.forEach(q => {
      const a = answers[q.id];
      if (q.type === "fib" && (typeof a !== "string" || a.trim() === "")) hasBlank = true;
      else if (a === undefined || a === null) hasBlank = true;
    });

    if (hasBlank) {
      if (!confirm("You have unanswered questions. Are you sure you want to proceed to the submission screen?")) return;
    }
    setConfirmed(true);
  };

  if (!q) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No questions available.</div>;
 
  if (confirmed) return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: "#0f172a", marginBottom: 8 }}>Confirm Submission</h2>
        {errorMsg && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{errorMsg}</div>}
        <p style={{ color: "#64748b", fontSize: 14 }}>You've answered {answered} of {qs.length} questions. Submit now?</p>
        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "center" }}>
          <button style={{...btnGhost, opacity: isSubmitting ? 0.5 : 1}} onClick={() => !isSubmitting && setConfirmed(false)} disabled={isSubmitting}>Go Back</button>
          <button 
            style={{...btnPrimary, opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? "not-allowed" : "pointer"}} 
            onClick={doSubmit} 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Exam"}
          </button>
        </div>
      </div>
    </div>
  );
 
  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ background: "#0f172a", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{exam.title}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{student.fullName} · {student.regNumber}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Progress</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>{answered}/{qs.length}</div>
          </div>
          <div style={{ padding: "10px 20px", borderRadius: 10, background: urgent ? "#dc2626" : "#1e293b", border: `2px solid ${urgent ? "#f87171" : "#334155"}`, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: urgent ? "#fca5a5" : "#64748b", textTransform: "uppercase" }}>Time Left</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: urgent ? "#fff" : "#60a5fa", fontVariantNumeric: "tabular-nums" }}>{fmt(timeLeft)}</div>
          </div>
          <button onClick={handleConfirmSubmit} style={{ ...btnPrimary, background: "#16a34a" }}>Submit Exam</button>
        </div>
      </div>
      <div style={{ height: 4, background: "#1e293b" }}>
        <div style={{ height: "100%", background: "#3b82f6", width: `${pct}%`, transition: "width 0.3s" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>Question {current + 1} of {qs.length}</div>
            <p style={{ fontSize: 17, fontWeight: 600, color: "#0f172a", lineHeight: 1.6, margin: "0 0 24px" }}>{q.text}</p>
            
            {/* MCQ Question Type */}
            {(!q.type || q.type === "mcq") && (
              <div 
                role="radiogroup" 
                aria-label="Multiple choice options"
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {q.options.map((o, i) => {
                  const sel = answers[q.id] === i;
                  const label = String.fromCharCode(65 + i);
                  return (
                    <button 
                      key={i} 
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: i }))} 
                      aria-checked={sel}
                      role="radio"
                      style={{ padding: "14px 18px", borderRadius: 10, border: `2px solid ${sel ? "#3b82f6" : "#e2e8f0"}`, background: sel ? "#eff6ff" : "#fff", cursor: "pointer", textAlign: "left", fontSize: 14, color: sel ? "#1d4ed8" : "#334155", fontWeight: sel ? 600 : 400, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 14 }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: sel ? "#3b82f6" : "#f1f5f9", color: sel ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{sel ? "✓" : label}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Fill-in-the-blank Question Type */}
            {q.type === "fib" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label htmlFor={`q-${q.id}`} style={{ fontSize: 13, color: "#64748b" }}>Your Answer:</label>
                <input 
                  id={`q-${q.id}`}
                  style={{ ...inputStyle, width: "100%", maxWidth: 400 }} 
                  value={answers[q.id] || ""} 
                  onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} 
                  placeholder="Type your answer here..." 
                  aria-required="true"
                />
              </div>
            )}

            {/* True/False Question Type */}
            {q.type === "boolean" && (
              <div 
                role="radiogroup" 
                aria-label="True or False"
                style={{ display: "flex", gap: 12 }}
              >
                {["True", "False"].map(v => {
                  const val = v.toLowerCase();
                  const sel = (answers[q.id] || "") === val;
                  return (
                    <button 
                      key={v} 
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: val }))} 
                      role="radio"
                      aria-checked={sel}
                      style={{ padding: "14px 24px", minWidth: 120, borderRadius: 10, border: `2px solid ${sel ? "#3b82f6" : "#e2e8f0"}`, background: sel ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 14, color: sel ? "#1d4ed8" : "#334155", fontWeight: sel ? 600 : 400, transition: "all 0.15s" }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button style={btnGhost} onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>← Previous</button>
            <button style={btnPrimary} onClick={() => setCurrent(c => Math.min(qs.length - 1, c + 1))} disabled={current === qs.length - 1}>Next →</button>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", alignSelf: "start", position: "sticky", top: 80 }}>
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#374151" }}>Question Navigator</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginBottom: 16 }}>
            {qs.map((qq, i) => {
              const done = answers[qq.id] !== undefined && (typeof answers[qq.id] !== "string" || answers[qq.id].trim() !== "");
              const isCurrent = i === current;
              return <button key={i} onClick={() => setCurrent(i)} style={{ padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: isCurrent ? "#3b82f6" : done ? "#dcfce7" : "#f1f5f9", color: isCurrent ? "#fff" : done ? "#16a34a" : "#64748b" }}>{i + 1}</button>;
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: "#dcfce7", display: "inline-block" }}></span><span style={{ color: "#64748b" }}>Answered ({answered})</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: "#f1f5f9", display: "inline-block" }}></span><span style={{ color: "#64748b" }}>Not Answered ({qs.length - answered})</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, borderRadius: 3, background: "#3b82f6", display: "inline-block" }}></span><span style={{ color: "#64748b" }}>Current</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── RESULT SCREEN ────────────────────────────────────────────────────────────
function ResultScreen({ result, student, exam, onDone, message }) {
  const pct = Math.round(result.score / result.total * 100);
  const pass = pct >= 50;
  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif",padding:24}}>
      <div style={{background:"#fff",borderRadius:16,padding:40,maxWidth:440,width:"100%",textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.1)"}}>
        {message && <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:16}}>{message}</div>}
        <div style={{fontSize:72,marginBottom:12}}>{pass?"🏆":"📝"}</div>
        <h2 style={{fontSize:24,fontWeight:800,color:"#0f172a",margin:"0 0 4px"}}>{pass?"Congratulations!":"Exam Completed"}</h2>
        <p style={{color:"#64748b",fontSize:14,marginBottom:24}}>{student.fullName} · {exam.title}</p>
        
        <div style={{background:pass?"#f0fdf4":"#fef2f2",borderRadius:12,padding:24,marginBottom:24}}>
          <div style={{fontSize:52,fontWeight:900,color:pass?"#16a34a":"#dc2626",lineHeight:1}}>{pct}%</div>
          <div style={{fontSize:16,color:pass?"#16a34a":"#dc2626",fontWeight:600,marginTop:4}}>{pass?"PASS":"FAIL"}</div>
          <div style={{fontSize:14,color:"#64748b",marginTop:8}}>{result.score} correct out of {result.total} questions</div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24,textAlign:"left"}}>
          <div style={{background:"#f8fafc",borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:"#64748b",textTransform:"uppercase",marginBottom:4}}>Class</div>
            <div style={{fontSize:14,fontWeight:600}}>{student.className}</div>
          </div>
          <div style={{background:"#f8fafc",borderRadius:8,padding:14}}>
            <div style={{fontSize:11,color:"#64748b",textTransform:"uppercase",marginBottom:4}}>Subject</div>
            <div style={{fontSize:14,fontWeight:600}}>{exam.subject}</div>
          </div>
        </div>

        <button style={{...btnPrimary,width:"100%",padding:"13px",fontSize:15}} onClick={onDone}>Back to Portal</button>
      </div>
    </div>
  );
}

// ─── STUDENT PORTAL ───────────────────────────────────────────────────────────
function StudentPortal({ student, onLogout }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [examState, setExamState] = useState(null);
  const [activeExam, setActiveExam] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [submitFeedback, setSubmitFeedback] = useState("");
  const [initialSession, setInitialSession] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const res = await api.checkActiveSession();
      if (res.session) {
        setInitialSession(res);
        // Start the exam flow with this session
        await startExam(res.session.exam, res);
      }
    } catch (e) {
      console.error("Failed to check session", e);
    }
  }, []);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listStudentExams();
      setExams(res.data);
      await checkSession();
    } catch (e) {
      setError("Failed to load exams.");
    } finally {
      setLoading(false);
    }
  }, [checkSession]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const startExam = async (exam, sessionData = null) => {
    try {
      const res = await api.getStudentExam(Number(exam.id));
      const data = res.data;
      
      let remainingSeconds = (data.duration_minutes || 30) * 60;
      let initialAnswers = {};
      let initialIndex = 0;

      if (sessionData) {
        remainingSeconds = sessionData.remaining_seconds;
        initialAnswers = sessionData.session.answers_provided || {};
        initialIndex = sessionData.session.current_question_index || 0;
      } else {
        const startRes = await api.startExamSession(Number(exam.id));
        remainingSeconds = startRes.remaining_seconds;
      }

      const mappedExam = {
        ...data,
        duration: data.duration_minutes,
        remainingSeconds,
        initialAnswers,
        initialIndex,
        questionIds: (data.questions || []).map(q => String(q.id))
      };
      const mappedQuestions = (data.questions || []).map(q => ({
        id: String(q.id),
        text: q.question_text,
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        type: q.type || "mcq",
        correct_option: q.correct_option,
      }));
      setActiveExam(mappedExam);
      setExamState("taking");
      setExamQuestions(mappedQuestions);
    } catch (e) {
      console.error(e);
      alert("Failed to load exam details.");
    }
  };

  const handleSubmit = async ({ answers }) => {
    const payload = {
      answers: Object.entries(answers)
        .filter(([, sel]) => sel !== undefined && sel !== null && sel !== "")
        .map(([qid, sel]) => {
          const q = examQuestions.find(x => x.id === qid);
          let selected_option = sel;
          
          if (!q?.type || q.type === "mcq") {
            selected_option = String.fromCharCode(65 + Number(sel));
          } else if (q.type === "boolean") {
            selected_option = sel === "true" ? "A" : "B";
          }

          return {
            question_id: Number(qid),
            selected_option: String(selected_option)
          };
        })
    };
    try {
      const res = await api.submitExam(Number(activeExam.id), payload);
      setLastResult({ score: res.data.score, total: res.data.total_questions });
      setSubmitFeedback("Submission successful.");
      setExamState("result");
    } catch (e) {
      let msg = e.response?.data?.message || "Submission failed.";
      if (e.response?.status === 422 && e.response?.data?.errors) {
        const errs = e.response.data.errors;
        const first = Object.values(errs)[0];
        if (Array.isArray(first)) msg = first[0];
      }
      alert(msg);
      throw e;
    }
  };

  if (examState==="taking") {
    return <ExamInterface student={student} exam={activeExam} questions={examQuestions} onSubmit={handleSubmit}/>;
  }
  if (examState==="result") return <ResultScreen result={lastResult} student={student} exam={{
    title: activeExam.title,
    subject: activeExam.subject
  }} onDone={()=>{ setExamState(null); setActiveExam(null); setSubmitFeedback(""); }} message={submitFeedback} />;

  return (
    <div style={{minHeight:"100vh",background:"#f1f5f9",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{background:"#0f172a",padding:"16px 32px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>CBT Student Portal</div>
          <div style={{fontSize:12,color:"#64748b"}}>Welcome, {student.fullName}</div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:13,color:"#94a3b8"}}>{student.regNumber} · {student.className}</span>
          <button style={{...btnGhost,background:"#1e293b",color:"#94a3b8"}} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:32}}>
        <h2 style={{fontSize:20,fontWeight:800,color:"#0f172a",marginBottom:6}}>Available Exams</h2>
        <p style={{color:"#64748b",fontSize:14,marginBottom:24}}>Exams assigned to {student.className}</p>

        {loading && (
          <div style={{background:"#fff",borderRadius:12,padding:40,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:48,marginBottom:12}}>⏳</div>
            <p style={{color:"#64748b"}}>Loading exams…</p>
          </div>
        )}
        {!loading && exams.length===0 && (
          <div style={{background:"#fff",borderRadius:12,padding:40,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
            <div style={{fontSize:48,marginBottom:12}}>📭</div>
            <p style={{color:"#64748b"}}>No exams assigned to your class at the moment.</p>
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {!loading && exams.map(e => {
            const done = false;
            const myResult = null;
            return (
              <div key={e.id} style={{background:"#fff",borderRadius:12,padding:"20px 24px",boxShadow:"0 2px 8px rgba(0,0,0,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:"#0f172a",marginBottom:6}}>{e.title}</div>
                  <div style={{display:"flex",gap:14,fontSize:13,color:"#64748b"}}>
                    <span>📖 {e.subject}</span>
                    <span>⏱ {(e.duration_minutes||e.duration)} minutes</span>
                    <span>❓ {(e.num_questions||(e.questionIds?e.questionIds.length:0))} questions</span>
                  </div>
                </div>
                <div>
                  {done ? (
                    <Badge color="green">Completed</Badge>
                  ) : (
                    <button style={btnPrimary} onClick={()=>startExam(e)}>Start Exam →</button>
                  )}
                </div>
              </div>
            );
          })}
          {error && (
            <div style={{marginTop:16,background:"#fef2f2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13}}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

function LoginScreen({ onAdminLogin, onStudentLogin, students }) {
  const [mode] = useState(window.location.pathname.startsWith("/admin") ? "admin" : "student");
  const [regNum, setRegNum] = useState("");
  const [adminEmail, setAdminEmail] = useState("admin@cbtportal.edu");
  const [adminPw, setAdminPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const msg = localStorage.getItem('expired_message'); if (msg) { localStorage.removeItem('expired_message'); return msg; } return "";
  });

  const handleStudent = async () => {
    if (loading) return;
    if (!regNum.trim()) {
      setError("Please enter your registration number.");
      return;
    }
    setLoading(true);
    try {
      const loginVal = regNum.trim().toLowerCase();
      const res = await api.studentLogin(loginVal);
      const s = res.student;
      setError("");
      onStudentLogin({
        id: String(s.id),
        regNumber: s.registration_number,
        fullName: s.name,
        className: s.class_name,
        email: s.email || "",
        gender: s.gender || ""
      });
    } catch (e) {
      console.error("[Student Login Error]", e);
      const msg = e.response?.data?.message || "Login failed. Please check your registration number.";
      setError(msg);
      setLoading(false);
    }
  };

  const handleAdmin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const loginVal = adminEmail.trim().toLowerCase();
      const res = await api.adminLogin(loginVal, adminPw);
      setError("");
      onAdminLogin(res.user.role);
    } catch (e) {
      setError(e.response?.data?.message || "Incorrect admin credentials.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight:"100vh", fontFamily:"'Segoe UI',system-ui,sans-serif",
      background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",padding:24
    }}>
      <style>{`@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{width:"100%",maxWidth:420}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,background:"linear-gradient(135deg,#3b82f6,#60a5fa)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px",boxShadow:"0 8px 24px rgba(59,130,246,0.4)"}}>🎓</div>
          <h1 style={{color:"#fff",fontSize:26,fontWeight:900,margin:0,letterSpacing:"-0.03em"}}>CBT Examination Portal</h1>
          <p style={{color:"#64748b",fontSize:14,marginTop:6}}>Secure Online Testing System</p>
        </div>

        <div style={{background:"#fff",borderRadius:16,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>

          <div style={{padding:32}}>
            {mode==="student" ? (
              <>
                <p style={{fontSize:13,color:"#64748b",marginBottom:20,marginTop:0}}>Enter your registration number to access your assigned exams.</p>
                <Field label="Registration Number">
                  <TextInput
                    value={regNum}
                    onChange={e=>setRegNum(e.target.value)}
                    placeholder="e.g. STU/2024/001"
                    ariaLabel="Registration number"
                    pattern={"[A-Za-z0-9/\\-\\s]"}
                    maxLength={50}
                    onEnter={handleStudent}
                    disabled={loading}
                  />
                </Field>
                {error && <div style={{background:"#fef2f2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14}}>{error}</div>}
                <button 
                  type="button" 
                  disabled={loading}
                  style={{...btnPrimary,width:"100%",padding:"13px",fontSize:15,opacity:loading?0.7:1,cursor:loading?"not-allowed":"pointer"}} 
                  onClick={handleStudent}
                >
                  {loading ? "Accessing Exam Portal..." : "Access Exam Portal →"}
                </button>
              </>
            ) : (
              <>
                <p style={{fontSize:13,color:"#64748b",marginBottom:20,marginTop:0}}>Admin access to manage students, exams, and results.</p>
                <Field label="Email">
                  <div style={{position:"relative"}}>
                    <span aria-hidden="true" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#64748b"}}>📧</span>
                    <input
                      style={{...inputStyle,paddingLeft:36}}
                      type="email"
                      value={adminEmail}
                      onChange={e=>setAdminEmail(e.target.value)}
                      placeholder="admin@cbtportal.edu"
                      title="Enter admin email"
                      disabled={loading}
                      onKeyDown={e=>e.key==="Enter"&&handleAdmin()}
                    />
                  </div>
                </Field>
                <Field label="Admin Password">
                  <div style={{position:"relative"}}>
                    <span aria-hidden="true" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#64748b"}}>🔒</span>
                    <input
                      style={{...inputStyle,paddingLeft:36,paddingRight:42}}
                      type={showPw?"text":"password"}
                      value={adminPw}
                      onChange={e=>setAdminPw(e.target.value)}
                      placeholder="Enter admin password"
                      onKeyDown={e=>e.key==="Enter"&&handleAdmin()}
                      aria-label="Admin password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={()=>setShowPw(s=>!s)}
                      aria-pressed={showPw}
                      aria-label={showPw?"Hide password":"Show password"}
                      title={showPw?"Hide password":"Show password"}
                      style={{
                        position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
                        background:"none", border:"none", cursor:"pointer", color:"#64748b", padding:6
                      }}
                      disabled={loading}
                    >
                      {showPw ? "🙈" : "👁️"}
                    </button>
                  </div>
                </Field>
                {error && <div style={{background:"#fef2f2",color:"#dc2626",padding:"10px 14px",borderRadius:8,fontSize:13,marginBottom:14}}>{error}</div>}
                <button 
                  type="button" 
                  disabled={loading}
                  style={{...btnPrimary,width:"100%",padding:"13px",fontSize:15,opacity:loading?0.7:1,cursor:loading?"not-allowed":"pointer"}} 
                  onClick={handleAdmin}
                >
                  {loading ? "Logging in..." : "Login as Admin →"}
                </button>
                <p style={{fontSize:12,color:"#94a3b8",textAlign:"center",marginBottom:0,marginTop:16}}>Use the seeded admin account</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [session, setSession] = useState(() => {
    loadTokensFromStorage();
    const stored = localStorage.getItem("cbt_session");
    return stored ? JSON.parse(stored) : null;
  });
  const [data, setData] = useState({
    students: [],
    questions: [],
    exams: [],
    results: [],
    users: []
  });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { error: toastError } = toast;

  const fetchData = useCallback(async () => {
    if (session?.type !== "admin") return;
    setLoading(true);
    try {
      const promises = [
        api.listQuestions({ per_page: 1000 }),
        api.listAdminExams({ per_page: 1000 }),
        api.listStudents({ per_page: 1000 })
      ];
      if (session.role === "super_admin") {
        promises.push(api.listUsers());
      }
      const [qs, es, ss, us] = await Promise.all(promises);
      
      // Map Laravel resources back to what the frontend expects
      const mappedQs = (qs.data || []).map(q => ({
        id: String(q.id),
        subject: q.subject,
        class_name: q.class_name,
        type: q.type || "mcq",
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
        answer: q.answer,
        answerBool: q.answerBool
      }));

      const mappedEs = (es.data || []).map(e => ({
        id: String(e.id),
        title: e.title,
        subject: e.subject || "",
        class_name: e.class_name || "SS3",
        description: e.description,
        duration_minutes: e.duration_minutes,
        question_ids: (e.questions || []).map(q => String(q.id)),
        is_active: e.is_active,
        starts_at: e.starts_at,
        ends_at: e.ends_at
      }));

      const mappedSs = (ss.data || []).map(s => ({
        id: String(s.id),
        fullName: s.name,
        regNumber: s.registration_number,
        email: s.email,
        className: s.class_name || "SS3", // Default if not in backend
        gender: s.gender || "",
        isActive: Boolean(s.is_active)
      }));

      const mappedUs = us ? (us.data || []).map(u => ({
        id: String(u.id),
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.created_at
      })) : [];

      setData(prev => ({
        ...prev,
        questions: mappedQs,
        exams: mappedEs,
        students: mappedSs,
        users: mappedUs,
        adminRole: session.role
      }));
    } catch (err) {
      console.error("[fetchData error]", err);
      const msg = err.response?.data?.message || err.message || "Unknown error";
      toastError(`Failed to fetch data: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [session, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("cbt_session", JSON.stringify(session));
    } else {
      localStorage.removeItem("cbt_session");
      setTokens(null);
    }
  }, [session]);

  const logout = () => {
    setSession(null);
    if (window.location.pathname !== "/") window.history.replaceState(null, "", "/");
  };

  useEffect(() => {
    let lastActivity = Date.now();
    const expire = () => {
      localStorage.setItem('expired_message', 'Your session has expired due to inactivity.')
      setSession(null)
      if (window.location.pathname !== "/") window.history.replaceState(null, "", "/")
    }

    const updateActivity = () => { lastActivity = Date.now(); };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, updateActivity));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 10 * 60 * 1000) {
        expire();
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [])

  return (
    <>
      <style>{`*{box-sizing:border-box}body{margin:0}@keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <ToastContainer toasts={toast.toasts}/>
      {!session && (
        <LoginScreen
          students={data.students}
          onAdminLogin={(role) => { if (window.location.pathname !== "/admin") window.history.replaceState(null, "", "/admin"); setSession({type:"admin", role}); }}
          onStudentLogin={student => { if (window.location.pathname !== "/") window.history.replaceState(null, "", "/"); setSession({type:"student", student}); }}
        />
      )}
      {session?.type==="admin" && (
        <AdminPanel onLogout={logout} data={data} setData={setData} toast={toast}/>
      )}
      {session?.type==="student" && (
        <StudentPortal student={session.student} onLogout={logout}/>
      )}
    </>
  );
}
import { useMemo, useState } from "react";

const activities = [
  "Lead Add",
  "Lead Update",
  "Task Add",
  "Task Update",
  "Claim Add",
  "Policy Add",
  "Renew Policy"
];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export default function DailyActivityReportPage() {
  const [reportDate, setReportDate] = useState(today);
  const [recipient, setRecipient] = useState("");
  const [rows, setRows] = useState(() => activities.map((activity) => ({ activity, count: "", remarks: "" })));
  const [message, setMessage] = useState("");

  const emailBody = useMemo(() => {
    const lines = ["Hi Team,", "", `Please find my Daily Activity Report for ${reportDate}.`, "", "Activity | Count | Remarks", "---------|-------|--------"];
    rows.forEach((row) => lines.push(`${row.activity} | ${row.count || 0} | ${row.remarks || "-"}`));
    lines.push("", `Total Activities: ${rows.reduce((total, row) => total + (Number(row.count) || 0), 0)}`, "", "Regards,", "[Your Name]");
    return lines.join("\n");
  }, [reportDate, rows]);

  const updateRow = (index, field, value) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
    setMessage("");
  };

  const openEmailDraft = () => {
    if (!recipient.trim()) {
      setMessage("Enter at least one recipient email address before opening the draft.");
      return;
    }
    const subject = `Daily Activity Report — ${reportDate}`;
    window.location.href = `mailto:${encodeURIComponent(recipient.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: Daily Activity Report — ${reportDate}\n\n${emailBody}`);
      setMessage("Email subject and report copied to the clipboard.");
    } catch {
      setMessage("Unable to copy automatically. Please select the report text manually.");
    }
  };

  return (
    <div className="master-page">
      <section className="master-card master-card--table">
        <div className="master-card__header"><span>Daily Activity Report</span></div>
        <div style={{ padding: "20px" }}>
          <div className="form-grid" style={{ marginBottom: "18px" }}>
            <label className="form-field">Report Date<input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} /></label>
            <label className="form-field">Send To<input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="manager@company.com" /></label>
          </div>
          <div className="table-wrap">
            <table className="master-table">
              <thead><tr><th>Sl.No.</th><th>Activity</th><th>Today's Count</th><th>Remarks</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.activity}>
                <td>{index + 1}</td><td>{row.activity}</td>
                <td><input aria-label={`${row.activity} count`} type="number" min="0" value={row.count} onChange={(event) => updateRow(index, "count", event.target.value)} /></td>
                <td><input aria-label={`${row.activity} remarks`} value={row.remarks} onChange={(event) => updateRow(index, "remarks", event.target.value)} placeholder="Optional details" /></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: "18px" }}>
            <button type="button" className="secondary-button" onClick={copyEmail}>Copy Email</button>
            <button type="button" className="primary-button" onClick={openEmailDraft}>Open Email Draft</button>
          </div>
          {message ? <p className="feedback feedback--error" style={{ marginTop: "12px" }}>{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

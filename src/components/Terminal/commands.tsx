import resume from "@/resume.json";

const descriptions: Record<string, string> = {
  info: "About me",
  education: "My education; use education 0 or education 1 for details",
  research: "Research interests and current project",
  contact: "GitHub and email",
  publications: "Publication status",
  tools: "Research tools",
  travel: "Places I have visited",
  resume: "Resume availability",
  clear: "Clear the terminal",
  exit: "Return to the room",
};
const external = (href: string, text: string) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#8cc8fa" }}>{text}</a>;

function education(option = "") {
  const selected = option.trim();
  if (selected && !/^[01]$/.test(selected)) return "Choose education 0 (CSU) or education 1 (ZJE).";
  const entries = selected ? [resume.education[Number(selected)]] : resume.education;
  return <div className="terminal-output">
    {entries.map(entry => <p key={entry.institution}>
      <strong>{entry.institution}</strong><br />
      {entry.studyType} · {entry.area}<br />
      {entry.startDate}–{entry.endDate}{entry.startDate === "2027" ? " (anticipated)" : ""}<br />
      {entry.highlights.map(line => <span key={line}>• {line}<br /></span>)}
    </p>)}
  </div>;
}
const info = <p className="terminal-output"><strong>Yanbin Xu</strong><br />
  Final-year Computer Science and Technology undergraduate at the Dundee International Institute of Central South University.<br />
  Provisionally admitted to the direct PhD programme in Bioinformatics at ZJE through the postgraduate recommendation pathway.<br />
  Supervisor: Wanlu Liu. Planned direction: computational immunology.
</p>;
const research = <div className="terminal-output">
  <p><strong>Research interests</strong><br />{resume.skills.map(skill => skill.name).join(" · ")}</p>
  <p><strong>Current project</strong><br />Temporal tracking of T- and B-cell clonal dynamics from bulk and single-cell immune repertoire data.<br />
  Exploring longitudinal TCR/BCR tracking and changes in clonal abundance and cell-state composition. This is ongoing work.</p>
</div>;

export default {
  help: <div className="terminal-output"><p><strong>Available commands</strong></p>{Object.entries(descriptions).map(([name, description]) => <div key={name}><strong>{name.padEnd(14, "\u00a0")}</strong>{description}</div>)}</div>,
  info,
  about: info,
  education,
  experience: education,
  work: "My experience so far is academic. Use education to view the two stages.",
  research,
  skills: research,
  contact: <p className="terminal-output"><strong>GitHub</strong>: {external("https://github.com/HEIMA-programmer", "HEIMA-programmer")}<br /><strong>Email</strong>: {external("mailto:yann3434274@gmail.com", "yann3434274@gmail.com")}</p>,
  publications: "No publications yet. A space is reserved on the homepage for papers, DOIs and source code.",
  tools: "No research tools have been released yet. Future tools will appear on the homepage.",
  travel: "Beijing · Shanghai · Changsha · Osaka · Nara · Dali · Wuhan. Explore the map from the room menu.",
  resume: "My resume has not been uploaded yet. The Resume menu entry is reserved for it.",
  doc: "My resume has not been uploaded yet. No document is linked at the moment.",
};

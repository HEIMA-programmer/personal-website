import "./IntroSection.css";
import { Link, Stack, Typography } from "@mui/joy";

export default function IntroSection() {
  return (
    <Stack spacing={2}>
      <Typography level="h1">
        Hi, I'm Yanbin Xu <span className="wave">👋</span>
      </Typography>
      <Typography level="body-lg">
        I'm a final-year Computer Science and Technology undergraduate at the
        Dundee International Institute of{" "}
        <Link className="profile-highlight" data-accent="blue" href="https://www.csu.edu.cn/" target="_blank" rel="noopener noreferrer">Central South University</Link>.
      </Typography>
      <Typography level="body-lg">
        I've received provisional admission through the postgraduate recommendation
        pathway to the direct PhD programme in{" "}
        <Typography component="span" className="profile-highlight" data-accent="green">Bioinformatics</Typography> at the{" "}
        <Link className="profile-highlight" data-accent="violet" href="https://zje.zju.edu.cn/" target="_blank" rel="noopener noreferrer">Zhejiang University–University of Edinburgh Institute (ZJE)</Link>, under the supervision of{" "}
        <Link className="profile-highlight" data-accent="amber" href="https://labw.org/" target="_blank" rel="noopener noreferrer">Wanlu Liu</Link>. I plan to pursue research in{" "}
        <Typography component="span" className="profile-highlight" data-accent="teal">computational immunology</Typography>.
      </Typography>
    </Stack>
  );
}

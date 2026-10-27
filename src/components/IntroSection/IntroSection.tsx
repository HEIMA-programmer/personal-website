import "./IntroSection.css";
import { Stack, Typography } from "@mui/joy";

export default function IntroSection() {
  return (
    <Stack spacing={2}>
      <Typography level="h1">
        Hi, I'm Yanbin Xu <span className="wave">👋</span>
      </Typography>
      <Typography level="body-lg">
        I'm a final-year Computer Science and Technology undergraduate at the
        Dundee International Institute of Central South University.
      </Typography>
      <Typography level="body-lg">
        I've received provisional admission through the postgraduate recommendation
        pathway to the direct PhD programme in
        Bioinformatics at the Zhejiang University–University of Edinburgh
        Institute (ZJE), under the supervision of Wanlu Liu. I plan to pursue
        research in computational immunology.
      </Typography>
    </Stack>
  );
}

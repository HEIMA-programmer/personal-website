import { Stack, Typography } from "@mui/joy";
import { education } from "@/resume.json";
import ExperienceRow from "./ExperienceRow";
import PWASvg from "@/assets/pwa.svg?react";
import ChartSvg from "@/assets/chart.svg?react";

export default function ExperienceSection() {
  return (
    <>
      <Typography level="h2" marginBottom={3} marginTop={15}>
        Experience 🎓
      </Typography>

      <Stack direction="column" spacing={8}>
        {education.map((entry, index) => (
          <ExperienceRow
            key={entry.institution}
            work={{
              name: entry.institution,
              position: `${entry.studyType} · ${entry.area}`,
              url: entry.url,
              startDate: entry.startDate,
              endDate: entry.endDate,
              location: entry.location,
              highlights: entry.highlights,
              companyLogoUrl: `${import.meta.env.BASE_URL}institutions/${index === 0 ? "csu-emblem.png" : "zju-emblem.png"}`,
            }}
            symbolImageSvg={index === 0 ? PWASvg : ChartSvg}
            logoAlt={index === 0 ? "Central South University emblem" : "Zhejiang University emblem"}
            direction={index === 0 ? "left" : "right"}
            imgProps={{
              width: index === 0 ? 550 : 400,
              transform: index === 0 ? "rotate(10deg)" : "rotate(-10deg)",
            }}
          />
        ))}
      </Stack>
    </>
  );
}

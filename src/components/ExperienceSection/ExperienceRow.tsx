import { Grid } from "@mui/joy";
import ExperienceCard from "./ExperienceCard";
import { CSSProperties } from "react";
import { Work } from "@/types/resume";

interface Props {
  work: Work;
  logoAlt?: string;
  direction: "left" | "right";
  symbolImageSvg: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  imgProps?: CSSProperties;
}

export default function ExperienceRow({
  work,
  logoAlt,
  direction,
  symbolImageSvg: SymbolImageSvg,
  imgProps = {},
}: Props) {
  const left = direction === "left";

  return (
    <>
      <Grid container direction={left ? "row" : "row-reverse"} rowGap={10}>
        <Grid xs={12} md={7} zIndex={1}>
          <ExperienceCard work={work} logoAlt={logoAlt} />
        </Grid>
        <Grid
          xs={12}
          md={5}
          position="relative"
          sx={{
            marginTop: { xs: -25, md: 0 },
          }}
        >
          <SymbolImageSvg
            style={{
              position: "absolute",
              width: 700,
              right: !left ? -50 : "none",
              height: "auto",
              opacity: 0.3,
              ...imgProps,
            }}
          />
        </Grid>
      </Grid>
    </>
  );
}

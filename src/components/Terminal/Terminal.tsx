import { ReactTerminal, TerminalContextProvider } from "react-terminal";
import commands from "./commands";
import { Stack } from "@mui/material";
import TerminalLink from "./TerminalLink";
import { useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { playTypingSound } from "@/audio/interfaceSound";
import SoundEffectsControl from "../MainMenu/SoundEffectsControl";

// ReactTerminal renders plain string results inline; every result needs its own
// block and trailing spacing so the following prompt starts on a fresh line.
const response = (value: ReactNode) => <div className="terminal-response">{value}</div>;
const terminalCommands = Object.fromEntries(Object.entries(commands).map(([name, value]) => [
  name, typeof value === "function" ? (argument: string) => response(value(argument)) : response(value),
]));

export default function Terminal() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter")) playTypingSound(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function exit() {
    navigate(import.meta.env.VITE_ROUTE_ROOM);
  }

  return (
    <TerminalContextProvider>
      <Stack
        direction="column"
        justifyContent="flex-end"
        alignItems="stretch"
        height="100%"
        width="100%"
        sx={{ backgroundColor: "rgb(21, 21, 21)" }}
      >
        <ReactTerminal
          commands={{ ...terminalCommands, exit }}
          theme="material-dark"
          showControlBar={false}
          welcomeMessage={
            <div className="terminal-response">
              Welcome to Yanbin's research terminal. Type a command to explore.
              <br />
              {commands.help}
            </div>
          }
          errorMessage={
            <div className="terminal-response">
              Command not found! Type "<strong>help</strong>" to see a list of
              available commands.
            </div>
          }
        />
        <Stack
          direction="row"
          justifyContent="space-between"
          padding={1}
          width="100%"
        >
          <TerminalLink onClick={exit}>Exit</TerminalLink>
          <SoundEffectsControl />
        </Stack>
      </Stack>
    </TerminalContextProvider>
  );
}

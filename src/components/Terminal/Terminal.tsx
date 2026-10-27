import { ReactTerminal, TerminalContextProvider } from "react-terminal";
import commands from "./commands";
import { Stack } from "@mui/material";
import TerminalLink from "./TerminalLink";
import { useNavigate } from "react-router-dom";

export default function Terminal() {
  const navigate = useNavigate();

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
          commands={{ ...commands, exit }}
          theme="material-dark"
          showControlBar={false}
          welcomeMessage={
            <span>
              Welcome to Yanbin's research terminal. Type a command to explore.
              <br />
              {commands.help}
            </span>
          }
          errorMessage={
            <span>
              Command not found! Type "<strong>help</strong>" to see a list of
              available commands.
            </span>
          }
        />
        <Stack
          direction="row"
          justifyContent="space-between"
          padding={1}
          width="100%"
        >
          <TerminalLink onClick={exit}>Exit</TerminalLink>
        </Stack>
      </Stack>
    </TerminalContextProvider>
  );
}

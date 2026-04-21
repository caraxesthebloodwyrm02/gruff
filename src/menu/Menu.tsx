import React, { useEffect, useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { McpPanel } from "./panels/mcp.js";
import { InferencePanel } from "./panels/inference.js";
import { AgencyPanel } from "./panels/agency.js";
import { HorizonPanel } from "./panels/horizon.js";

export function Menu() {
  const { exit } = useApp();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (input === "q" || key.escape || (key.ctrl && input === "c")) exit();
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Box marginBottom={0}>
        <Text bold color="yellowBright">
          {"GRUFF "}
        </Text>
        <Text dimColor>workspace cockpit · q to quit</Text>
      </Box>

      <Box flexDirection="row" gap={1} marginTop={1}>
        {/* NW — green — MCP */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          width={40}
          paddingX={1}
        >
          <Text bold color="green">
            MCP  signal
          </Text>
          <McpPanel tick={tick} />
        </Box>

        {/* NE — red — inference */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          width={40}
          paddingX={1}
        >
          <Text bold color="red">
            inference  narrow-band
          </Text>
          <InferencePanel tick={tick} />
        </Box>
      </Box>

      <Box flexDirection="row" gap={1} marginTop={1}>
        {/* SW — yellow — agency */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="yellow"
          width={40}
          paddingX={1}
        >
          <Text bold color="yellow">
            agency  accumulated
          </Text>
          <AgencyPanel tick={tick} />
        </Box>

        {/* SE — blue/teal — horizon */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          width={40}
          paddingX={1}
        >
          <Text bold color="cyan">
            horizon  forward
          </Text>
          <HorizonPanel tick={tick} />
        </Box>
      </Box>
    </Box>
  );
}

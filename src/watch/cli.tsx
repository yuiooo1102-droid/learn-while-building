#!/usr/bin/env node
// src/watch/cli.tsx
import React from "react";
import { render } from "ink";
import App from "./app.js";

const port = parseInt(process.env.LWB_PORT ?? "3579", 10);
render(<App port={port} />);

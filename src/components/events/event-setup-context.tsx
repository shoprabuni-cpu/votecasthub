"use client";
import type { AuthFormState } from "@/lib/auth/form-state";
import { createContext, useContext } from "react";
export type SetupSection = "details" | "nominees" | "voting" | "review";
export type SetupEditor = { submit: () => void; validate: () => boolean };
export const EventSetupContext = createContext<{
  section: SetupSection;
  registerEditor: (editor: SetupEditor) => void;
  reportEditor: (state: { dirty: boolean; pending: boolean }) => void;
  editorSaved: (result: AuthFormState) => void;
} | null>(null);
export const useEventSetup = () => useContext(EventSetupContext);

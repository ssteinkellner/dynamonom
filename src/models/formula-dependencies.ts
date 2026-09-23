import {
  ACTION_TYPES,
  getActionFormulaFields,
  getEnabledCurrentFormulaProperties,
} from "../action-model.ts";
import type { Action } from "../action-model.ts";
import { getNumericFormulaDependencies } from "../formula-engine.ts";

export interface FormulaDependencyCycle {
  actionId: string;
  actionName: string;
  fields: string[];
}

export function findActionFormulaCycles(action: Action): string[][] {
  const activeFields = new Set(getEnabledCurrentFormulaProperties(action));
  const dependencies = new Map<string, Set<string>>();

  for (const { field, input } of getActionFormulaFields(action)) {
    if (!activeFields.has(field)) {
      continue;
    }
    const currentDependencies = new Set(
      getNumericFormulaDependencies(input).filter((property) =>
        activeFields.has(property),
      ),
    );
    if (
      action.type === ACTION_TYPES.METRONOME &&
      action.settings.increaseTempo &&
      action.settings.maximum !== "none" &&
      field === getActiveMaximumLimitField(action.settings.maximum)
    ) {
      currentDependencies.add("bpm");
    }
    if (
      action.type === ACTION_TYPES.METRONOME &&
      action.settings.lockSettings &&
      action.settings.sessionEndEnabled &&
      field === "lockBeats"
    ) {
      currentDependencies.add("sessionEndBeats");
    }
    dependencies.set(field, currentDependencies);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const cycleKeys = new Set<string>();

  const visit = (field: string): void => {
    const currentState = state.get(field);
    if (currentState === "done") {
      return;
    }
    if (currentState === "visiting") {
      const start = stack.indexOf(field);
      if (start >= 0) {
        const cycle = [...stack.slice(start), field];
        const key = cycle.slice(0, -1).sort().join("|");
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(cycle);
        }
      }
      return;
    }

    state.set(field, "visiting");
    stack.push(field);
    for (const dependency of dependencies.get(field) ?? []) {
      if (dependencies.has(dependency)) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(field, "done");
  };

  for (const field of dependencies.keys()) {
    visit(field);
  }
  return cycles;
}

export function findFormulaDependencyCycles(
  actions: readonly Action[],
): FormulaDependencyCycle[] {
  const cycles: FormulaDependencyCycle[] = [];
  for (const action of actions) {
    for (const fields of findActionFormulaCycles(action)) {
      cycles.push({ actionId: action.id, actionName: action.name, fields });
    }
  }
  return cycles;
}

function getActiveMaximumLimitField(
  maximum: "stick" | "reset" | "reverse",
): string {
  return `maximumLimit${maximum[0]?.toUpperCase() ?? ""}${maximum.slice(1)}`;
}

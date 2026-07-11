import { getDefaultHotkeys } from "./configUtility";

const knownActions = getDefaultHotkeys().map((entry) => entry.action);

/**
 * Split a compound options-page label like "To Hand/To Extra Deck" into its
 * underlying action names. Action names may themselves contain "/" (e.g.
 * "To S/T"), so greedily match the longest run of "/"-joined parts that is a
 * known action instead of splitting blindly.
 */
export function splitActions(
  label: string,
  actionNames: string[] = knownActions,
): string[] {
  if (!label.includes("/")) return [label];

  const parts = label.split("/");
  const result: string[] = [];
  let i = 0;
  while (i < parts.length) {
    let matchEnd = -1;
    let candidate = "";
    for (let j = i; j < parts.length; j++) {
      candidate = candidate === "" ? parts[j] : `${candidate}/${parts[j]}`;
      if (actionNames.includes(candidate)) matchEnd = j;
    }
    if (matchEnd === -1) {
      result.push(parts[i]);
      i += 1;
    } else {
      result.push(parts.slice(i, matchEnd + 1).join("/"));
      i = matchEnd + 1;
    }
  }
  return result;
}

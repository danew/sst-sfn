import { CustomResourceOptions } from "@pulumi/pulumi";

// Borrowed from .sst/platform/src/components/component.ts
export type Transform<T> =
  | Partial<T>
  | ((args: T, opts: CustomResourceOptions, name: string) => undefined);
export function transform<T extends object>(
  transform: Transform<T> | undefined,
  name: string,
  args: T,
  opts: CustomResourceOptions,
) {
  // Case: transform is a function
  if (typeof transform === "function") {
    transform(args, opts, name);
    return [name, args, opts] as const;
  }

  // Case: no transform
  // Case: transform is an argument
  return [name, { ...args, ...transform }, opts] as const;
}

// Borrowed from sst/platform/src/components/naming
export function physicalName(
  maxLength: number,
  name: string,
  suffix: string = "",
) {
  // This function does the following:
  // - Removes all non-alphanumeric characters
  // - Prefixes the name with the app name and stage
  // - Truncates the name if it's too long

  name = name.replace(/[^a-zA-Z0-9]/g, "");

  const prefixedName = (() => {
    const L = maxLength - suffix.length;
    const appLen = $app.name.length;
    const stageLen = $app.stage.length;
    const nameLen = name.length;

    if (appLen + stageLen + nameLen + 2 <= L) {
      return `${$app.name}-${$app.stage}-${name}`;
    }

    if (stageLen + nameLen + 1 <= L) {
      const appTruncated = $app.name.substring(0, L - stageLen - nameLen - 2);
      return appTruncated === ""
        ? `${$app.stage}-${name}`
        : `${appTruncated}-${$app.stage}-${name}`;
    }

    const stageTruncated = $app.stage.substring(
      0,
      Math.max(8, L - nameLen - 1),
    );
    const nameTruncated = name.substring(0, L - stageTruncated.length - 1);
    return `${stageTruncated}-${nameTruncated}`;
  })();

  return `${prefixedName}${suffix}`;
}
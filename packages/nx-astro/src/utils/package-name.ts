const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

export const isPackageName = (name: string) => PACKAGE_NAME.test(name);

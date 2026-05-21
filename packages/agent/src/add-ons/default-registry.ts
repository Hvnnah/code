import { AddOnRegistry } from "./registry";
import { ztkAddOn } from "./ztk";

/**
 * Process-wide default registry. Built-in add-ons are registered here so
 * adapters can resolve them without ceremony.
 */
export const defaultAddOnRegistry = new AddOnRegistry();
defaultAddOnRegistry.register(ztkAddOn);

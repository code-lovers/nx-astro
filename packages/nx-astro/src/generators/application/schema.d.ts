export interface ApplicationGeneratorSchema {
  readonly directory: string;
  readonly name?: string;
  readonly tags?: string;
  readonly integrations?: readonly string[];
  readonly skipFormat?: boolean;
}

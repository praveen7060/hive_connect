import type { FormEvent } from "react";

export type PrimitiveValue = string | number | boolean | null | File;

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "boolean"
  | "textarea"
  | "file"
  | "checkbox";

export interface FormFieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface ManagementFormProps {
  formId: string;
  formTitle: string;
  formSubtitle: string;
  editing: boolean;
  values: Record<string, any>;
  onValueChange: (key: string, value: any) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

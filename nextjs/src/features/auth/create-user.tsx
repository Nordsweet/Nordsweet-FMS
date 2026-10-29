"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { api } from "~/api";
import { AviationApiError } from "~/api/aviation/client";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useT } from "~/i18n/use-t";
import { useAuth } from "~/stores/auth";

/** Admin only: creates an account in Zitadel through the Aviation API (which holds the Zitadel credential). */
export function CreateUser() {
  const t = useT();
  const isAdmin = useAuth((s) => s.session?.role === "admin");
  const [role, setRole] = useState<"user" | "admin">("user");
  const create = useMutation(api.auth.createUser.mutationOptions());
  if (!isAdmin) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const raw = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    const text = (name: string) => raw(name).trim();
    create.mutate(
      {
        username: text("username"),
        first_name: text("first_name"),
        last_name: text("last_name"),
        email: text("email"),
        password: raw("password"),
        role,
      },
      { onSuccess: () => form.reset() },
    );
  };

  const error = create.error;
  const message =
    error === null
      ? null
      : !(error instanceof AviationApiError)
        ? t("auth.error.offline")
        : error.status === 409
          ? t("users.error.taken")
          : error.status === 403
            ? t("users.error.forbidden")
            : error.status === 422
              ? t("users.error.invalid")
              : error.status === 503
                ? t("users.error.notConfigured")
                : error.message;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>
          <h2>{t("users.title")}</h2>
        </CardTitle>
        <p className="text-muted-foreground text-sm">{t("users.intro")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          {(
            [
              ["username", "users.username", "text"],
              ["first_name", "users.firstName", "text"],
              ["last_name", "users.lastName", "text"],
              ["email", "users.email", "email"],
              ["password", "users.password", "password"],
            ] as const
          ).map(([name, label, type]) => (
            <div key={name} className="grid gap-1.5">
              <Label htmlFor={`new-user-${name}`}>{t(label)}</Label>
              <Input
                id={`new-user-${name}`}
                name={name}
                type={type}
                autoComplete={name === "password" ? "new-password" : "off"}
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={name === "password" ? 8 : undefined}
              />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="new-user-role">{t("users.role")}</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "user" | "admin")}
            >
              <SelectTrigger id="new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{t("users.role.user")}</SelectItem>
                <SelectItem value="admin">{t("users.role.admin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {message && (
            <p role="alert" className="text-destructive text-sm">
              {message}
            </p>
          )}
          {create.isSuccess && (
            <p role="status" className="text-sm">
              {t("users.created", { username: create.data.username })}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {t(create.isPending ? "users.creating" : "users.create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

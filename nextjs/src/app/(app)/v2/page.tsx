"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useT } from "~/i18n/use-t";

export default function PlanPage() {
  const t = useT();
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>
          <h1>{t("plan.title")}</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{t("plan.comingSoon")}</p>
        <Button asChild>
          <Link href="/">{t("plan.openLegacy")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

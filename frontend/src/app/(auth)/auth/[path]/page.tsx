import { AuthView } from "@daveyplate/better-auth-ui"
import { authViewPaths } from "@daveyplate/better-auth-ui/server"

import { DocsLink } from "~/components/docs-link"

export const dynamicParams = false

export function generateStaticParams() {
    return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
    const { path } = await params

    return (
        <>
            {/* Signed-out visitors can read the architecture walkthrough without
                creating an account — /docs touches no user data. */}
            <div className="absolute top-4 right-4 z-10">
                <DocsLink />
            </div>
            <main className="container flex grow flex-col items-center justify-center self-center p-4 md:p-6">
                <AuthView path={path} />
            </main>
        </>
    )
}
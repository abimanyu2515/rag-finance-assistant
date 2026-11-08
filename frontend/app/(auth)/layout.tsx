import React from "react"

const AuthLayout = ({ children }: {children: React.ReactNode}) => {
  return (
    // Auth screens are styled for dark only, so pin them to the dark palette whatever the saved theme
    <main className="dark bg-black text-white min-h-dvh flex flex-col lg:flex-row items-center justify-center lg:justify-evenly gap-10 lg:gap-16 px-6 py-10">
        <section className="flex flex-col text-center lg:text-left">
            <h1 className="text-5xl sm:text-6xl lg:text-8xl"> <span className="text-title">Q</span>UERY <br className="hidden lg:block" /><span className="text-title">Fi</span></h1>
            <p className="mt-3 lg:mt-5 text-sm sm:text-base max-w-md">The best finance app powered by <span className="text-rag">Retrieval Augment Generation</span></p>
        </section>

        <section className="w-full max-w-sm">{children}</section>
    </main>
  )
}

export default AuthLayout
'use client'

import FooterLink from "@/components/form/FooterLink"
import InputField from "@/components/form/InputField"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

const SignUp = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setLoading(true);

    try{
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: (e.target as HTMLFormElement).fullname.value,
          email: (e.target as HTMLFormElement).email.value,
          password: (e.target as HTMLFormElement).password.value
        })
      })

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to sign up")
      }

      toast.success("Account created", { description: "Sign in with your new email and password." })
      router.push('/sign-in')

    } catch (error) {
        console.error("Unable to Sign Up", error)
        toast.error("Couldn’t create your account", {
          description: error instanceof Error ? error.message : undefined,
        })
    } finally {
        setLoading(false)
    }
  };

  return (
    <>
      <h1 className="text-xl text-center mb-6 lg:mb-10">Welcome to <span className="text-title">Query-Fi</span></h1>

      <form className="w-full flex flex-col space-y-5" onSubmit={handleSubmit}>
        <InputField 
          name="fullname"
          label="Full Name"
          placeholder="Enter your full name"
          value=""
        />

        <InputField 
          name="email"
          label="Email"
          placeholder="Enter your email address"
          value=""
        />
        
        <InputField 
          name="password"
          label="Password"
          placeholder="Enter your password"
          value=""
          type="password"
        />

        <button type="submit" className="h-12 rounded-lg border-2 border-yellow-300 bg-yellow-400 px-3 text-black hover:bg-black hover:text-yellow-300 hover:font-semibold cursor-pointer">Sign Up</button>

        <FooterLink text="Already have an account?" linkText="Sign In" href="/sign-in" />
      </form>
    </>
  )
}

export default SignUp
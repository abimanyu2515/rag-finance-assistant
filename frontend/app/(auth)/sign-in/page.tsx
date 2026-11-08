'use client'

import FooterLink from "@/components/form/FooterLink"
import InputField from "@/components/form/InputField"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const SignIn = () => {
  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn('credentials', {
      redirect: false,
      email: (e.target as any).email.value,
      password: (e.target as any).password.value,
    })

    if (res?.error) {
      toast.error("Invalid email or password")
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <>
      <h1 className="text-xl text-center mb-6 lg:mb-10">Welcome Back..!</h1>

      <form className="w-full flex flex-col space-y-5" onSubmit={handleSubmit}>
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

        <button type="submit" className="h-12 rounded-lg border-2 border-yellow-300 bg-yellow-400 px-3 text-black hover:bg-black hover:text-yellow-300 hover:font-semibold cursor-pointer">Sign In</button>

        <FooterLink text="Don't have an account?" linkText="Sign Up" href="/sign-up" />
      </form>
    </>
  )
}

export default SignIn
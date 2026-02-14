import Image from "next/image"

const CustomStats = ({ title, icon, value, info }: StatsProps) => {
  const StatIcon = icon;
  return (
    <div className='bg-[#092e72] p-5 rounded-lg'>
        <div className='flex justify-between mb-5 gap-10'>
            <h1>{title}</h1>
            <StatIcon />
        </div>
        <span className='text-3xl font-bold'>{value}</span>
        <p className={`mt-2.5 ${!info.startsWith('+') ? 'text-red-500' : 'text-green-400'} font-medium`}>{info}</p>  
    </div>
  )
}

export default CustomStats
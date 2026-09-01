import { Building2, FileCheck2, Users, Workflow } from 'lucide-react';
import BorderLayout from '../layout/borderLayout'

export default function HowItWorks() {
    const cards = [
        {
            icon: <Building2 />,
            title: "Company Registration",
            description:
                "System administrators register companies and assign company admins",
        },
        {
            icon: <Users />,
            title: "Employee Management",
            description:
                "Company admins add and manage their employees in the system",
        },
        {
            icon: <FileCheck2 />,
            title: "Proof Generation",
            description:
                "Employees generate time-limited proof codes for employment verification",
        },
    ];

    return (
        <BorderLayout id="how-it-works" >
            <div className="seciton-py">
                <div className='font-matter space-y-4 pb-8 flex flex-col items-center justify-center text-center'>
                    {/* label */}
                    <div className='text-xs text-secondary-black flex gap-1.5 px-3.5 py-1 bg-white items-center shadow border border-gray rounded-full w-fit [&>svg]:size-4'>
                        How it works <Workflow/>
                    </div>
                    {/* title */}
                    <div className='text-[32px] lg:text-[48px] text-[#141414] font-cal text-balance leading-tight'>
                        Streamlined company and employee management
                    </div>
                    {/* description */}
                    <div className='text-base lg:text-lg text-gray-700 max-w-2xl'>
                        From registering your company to managing employees and generating instant proof of employment —
                        our platform makes every step seamless and secure.
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cards.map((item, i) => (
                        <div key={i} className="font-matter overflow-hidden bg-white border border-gray rounded-2xl">
                            <div className="p-5 pb-10">
                                <div className="inline-block p-2 font-mono text-[#6b7280] mb-3 text-sm rounded-md bg-[#e5e7eb] font-bold">
                                    {item.icon}
                                </div>
                                <div className="mb-[6px] text-[18px] text-[#141414] font-semibold">
                                    {item.title}
                                </div>
                                <p className="text-[16px] text-gray-700">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </BorderLayout>
    )
}

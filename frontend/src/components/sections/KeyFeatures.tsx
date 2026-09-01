import BorderLayout from "../layout/borderLayout";
import RevealKeyFeaturesOnHover from "./RevealKeyFeaturesOnHover";

export default function KeyFeatures() {
  return (
    <BorderLayout id="key-features">
      <div className="seciton-py">
        <div className="text-center -mx-7">
          <div className='font-matter space-y-4 pb-8 flex flex-col items-center justify-center text-center'>
            {/* title */}
            <div className='text-[32px] lg:text-[48px] text-[#141414] font-cal text-balance leading-tight'>
              …and so much Key Features!
            </div>
            {/* description */}
            <div className='text-base lg:text-lg text-gray-700 max-w-2xl'>
              Built on blockchain for maximum security and transparency.
            </div>
          </div>
          <RevealKeyFeaturesOnHover />
        </div>
      </div>
    </BorderLayout>
  )
}

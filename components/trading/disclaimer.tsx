'use client'

export function Disclaimer() {
  const disclaimerPoints = [
    'Stoploss and Trailing Stoploss feature will only work if 1Cliq trading window is opened.',
    'Stoploss and Trailing Stoploss will be removed if 1Cliq window has been reloaded.',
    'Orders placed after market hours for any/testing purposes will be placed by 1Cliq with the AMO flag enabled; therefore, if you do not want those orders to be executed on the following trading day, be sure to cancel them.',
    'We are not responsible for any of Losses you may incur by using 1Cliq.',
    'We are not SEBI registered investment/financial advisers. Please consult your investment/financial adviser before trading/investing.',
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Notes & Disclaimer:</h3>
      <ul className="space-y-3">
        {disclaimerPoints.map((point, index) => (
          <li key={index} className="flex gap-3">
            <span className="flex-shrink-0 text-gray-500 font-medium">{index + 1}.</span>
            <span className="text-sm md:text-base text-gray-700 leading-relaxed">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

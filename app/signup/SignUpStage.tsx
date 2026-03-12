'use client'
import React from "react"

type Stage = {
  num: number
  label: string
}

type SignUpStageProps = {
  currentStage: number
  stages?: Stage[]
}

export default function SignUpStage({
  currentStage,
  stages = [
    { num: 1, label: "Basic" },
    { num: 2, label: "Personal" },
  ],
}: SignUpStageProps) {

  return (
    <div className="w-full flex items-start">
      {stages.map((stage, index) => {
        const isActive = stage.num === currentStage
        const isCompleted = stage.num < currentStage

        return (
          <React.Fragment key={stage.num}>
            
            {/* Stage */}
            <div className="flex flex-col items-center relative">
              
              {/* Circle */}
              <div
                className={`
                  w-10 h-10 flex items-center justify-center
                  rounded-full border-2 font-semibold transition
                  ${isCompleted && "bg-primary border-primary text-white"}
                  ${isActive && "bg-primary border-primary text-white"}
                  ${!isCompleted && !isActive && "border-gray-300 text-gray-500"}
                `}
              >
                {stage.num}
              </div>

              {/* Label */}
              <p
                className={`
                  text-sm mt-2 font-medium text-center
                  ${isActive ? "text-black" : "text-gray-500"}
                `}
              >
                {stage.label}
              </p>

            </div>

            {/* Connector Line */}
            {index < stages.length - 1 && (
              <div className="flex-1 flex items-center px-2 mt-4">
                <div
                  className={`
                    h-[4px] w-full rounded-full transition
                    ${stage.num < currentStage ? "bg-primary" : "bg-gray-200"}
                  `}
                />
              </div>
            )}

          </React.Fragment>
        )
      })}
    </div>
  )
}
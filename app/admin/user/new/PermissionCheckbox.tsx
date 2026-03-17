"use client";

import React, { useState, useEffect } from "react";
import { toggleUserPermission } from "./api";
import { BracketCheckbox } from "@/components/BracketCheckbox ";

interface PermissionCheckboxProps {
  groupName: string;
  title: string;
  type: string;
  userId: string;
  defaultValue?: boolean;
  url?: string;
}

export const PermissionCheckbox: React.FC<PermissionCheckboxProps> = ({
  groupName,
  title,
  type,
  userId,
  defaultValue = false,
  url,
}) => {
  const [checked, setChecked] = useState(defaultValue);

  useEffect(() => {
    setChecked(defaultValue);
  }, [defaultValue]);

  const handleChange = async (newChecked: boolean) => {
    
    setChecked(newChecked);

    await toggleUserPermission(userId, groupName, title, newChecked, url);
  };

  return (
    <div className="flex items-center gap-2 mb-1">
      {/* <input
        type="checkbox"
        id={`${groupName}-${title}`}
        className="permission-checkbox"   
        checked={checked}
        onChange={handleChange}
      /> */}

      <BracketCheckbox checked={checked} onChange={handleChange} />

        < label htmlFor={`${groupName}-${title}`}>
        {title} ({type})
      </label>
    </div>
  );
};

import { IconType } from 'react-icons/lib/cjs/iconBase';
import React from 'react';

export const SideBarPage = (props: Props) => {
  return <div>{props.children}</div>;
};

type Props = {
  icon: IconType;
  children: React.ReactNode;
};

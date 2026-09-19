import React from 'react';
import { Redirect } from 'expo-router';

export default function HiddenMyFarmTab() {
  return <Redirect href="/(tabs)" />;
}

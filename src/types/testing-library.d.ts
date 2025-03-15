declare module '@testing-library/react' {
  export const render: any;
  export const screen: any;
  export const fireEvent: any;
  export const waitFor: any;
}

declare module '@testing-library/jest-dom' {
  // This is just to make the import work
} 
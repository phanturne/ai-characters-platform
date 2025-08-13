import Form from 'next/form';

import { signOut } from '@/app/(auth)/actions';

export const SignOutForm = () => {
  return (
    <Form className="w-full" action={signOut}>
      <button
        type="submit"
        className="w-full text-left px-1 py-0.5 text-red-500"
      >
        Sign out
      </button>
    </Form>
  );
};

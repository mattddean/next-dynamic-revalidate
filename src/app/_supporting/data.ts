export async function fetchPage() {
  // add a 5 second delay so that it's clean when we are making the user wait
  await new Promise((r) => setTimeout(r, 5000))

  return { data: 'hello' }
}

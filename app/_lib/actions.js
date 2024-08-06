"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "./auth";
import { supabase } from "./supabase";
import { getBookings } from "./data-service";
import { redirect } from "next/navigation";

export async function updateGuest(formData) {
  const session = await auth();
  if (!session) throw new Error("You must be logged in");
  const nationalID = formData.get("nationalID");
  const [nationality, countryFlag] = formData.get("nationality").split("%");

  const regex = /^[a-zA-Z0-9]{6,12}$/;
  const isValid = regex.test(nationalID);
  if (!isValid) throw new Error("Invalid National ID");

  const updateData = { nationality, countryFlag, nationalID };

  const { data, error } = await supabase
    .from("guests")
    .update(updateData)
    .eq("id", session.user.guestId);

  if (error) throw new Error("Guest could not be updated");

  revalidatePath("/account/profile");
}

export async function deleteReservation(id) {
  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  const guestBookings = await getBookings(session.user.guestId);

  const booking = guestBookings.find((booking) => booking.id === id);
  if (!booking) throw new Error("Booking not found");

  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) throw new Error("Booking could not be deleted");

  revalidatePath("/account/reservations");
}

export async function updateReservation(formData) {
  const bookingId = formData.get("bookingId");
  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  const guestBookings = await getBookings(session.user.guestId);
  const booking = guestBookings.find(
    (booking) => String(booking.id) === bookingId
  );
  if (!booking) throw new Error("Booking not found");

  const observations = formData.get("observations").slice(0, 1000);
  const numGuests = formData.get("numGuests");

  const updatedBooking = {
    observations,
    numGuests,
  };

  const { error } = await supabase
    .from("bookings")
    .update(updatedBooking)
    .eq("id", bookingId);

  if (error) throw new Error("Reservation could not be updated");

  revalidatePath(`/account/reservations/edit/${bookingId}`);

  redirect("/account/reservations");
}

export async function createBooking(bookingData, formData) {
  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  const numGuests = formData.get("numGuests");
  const observations = formData.get("observations").slice(0, 1000);

  const newBooking = {
    ...bookingData,
    observations,
    numGuests,
    guestId: session.user.guestId,
    totalPrice: bookingData.cabinPrice,
    isPaid: false,
    extrasPrice: 0,
    hasBreakfast: false,
    status: "unconfirmed",
  };

  const { error } = await supabase.from("bookings").insert([newBooking]);

  if (error) throw new Error("Booking could not be created");

  revalidatePath(`/cabins/${bookingData.cabinId}`);
  redirect("/cabins/thankyou");
}

export async function signInAction() {
  await signIn("google", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      offset={24}
      gap={8}
      visibleToasts={6}
      expand={false}
      closeButton={false}
      richColors={false}
      toastOptions={{
        duration: 2500,
        className: "lux-cart-toast",
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

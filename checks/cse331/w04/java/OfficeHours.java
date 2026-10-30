/** Office hours: students join the help queue, and a TA helps them. */
public class OfficeHours {
    public static void main(String[] args) {
        ListQueue queue = new ListQueue();
        // Students join at the back.
        queue.join("ada");
        queue.join("bob");
        // The TA shows who is waiting, then helps the first.
        System.out.println(queue.waiting());
        System.out.println("helping " + queue.next());
    }
}

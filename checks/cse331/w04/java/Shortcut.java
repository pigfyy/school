/** A client that takes a shortcut past join, into ListQueue's list. */
public class Shortcut {
    public static void main(String[] args) {
        ListQueue queue = new ListQueue();
        queue.join("ada");
        queue.join("bob");
        // Skip join and change the list itself.
        queue.queue.add("ada");
        queue.queue.add(0, "eve");
        System.out.println(queue.waiting());
        System.out.println("helping " + queue.next());
    }
}

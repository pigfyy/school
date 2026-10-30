import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;

/** A help queue kept as a chain of nodes, one node per student. */
public class LinkedQueue implements HelpQueue {
    /** One student waiting, and the node of the student after them. */
    private static class Node {
        String netid;
        Node next;  // null for the last node in the chain

        Node(String netid) {
            this.netid = netid;
        }
    }

    // The first and last nodes of the chain, both null when nobody
    // is waiting.
    private Node front;
    private Node back;

    public int size() {
        int n = 0;
        for (Node node = front; node != null; node = node.next) {
            n++;
        }
        return n;
    }

    public void join(String netid) {
        // Walk the chain for the student, as ListQueue walks its list.
        for (Node node = front; node != null; node = node.next) {
            if (node.netid.equals(netid)) {
                throw new IllegalArgumentException(
                    netid + " is already waiting");
            }
        }
        // Add the new node after the last node, or start the chain with it.
        Node node = new Node(netid);
        if (back == null) {
            front = node;
        } else {
            back.next = node;
        }
        back = node;
    }

    public String next() {
        if (front == null) {
            throw new NoSuchElementException("nobody is waiting");
        }
        // Unhook the first node; if it was also the last, the chain is
        // empty now.
        String netid = front.netid;
        front = front.next;
        if (front == null) {
            back = null;
        }
        return netid;
    }

    public List<String> waiting() {
        List<String> list = new ArrayList<String>();
        for (Node node = front; node != null; node = node.next) {
            list.add(node.netid);
        }
        return list;
    }
}

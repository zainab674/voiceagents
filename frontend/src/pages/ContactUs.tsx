import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Mail, Send, MessageSquare, ShieldCheck, ArrowLeft, Phone } from "lucide-react";
import { contactApi } from "@/http/contactHttp";
import { useAuth } from "@/contexts/AuthContext";

const ContactUs = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [subject, setSubject] = useState("");
    const [email, setEmail] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation: Guests must provide an email
        if (!user && !email) {
            toast.error("Please provide your email address");
            return;
        }

        if (!subject || !description) {
            toast.error("Please fill in all fields");
            return;
        }

        setIsSubmitting(true);
        try {
            await contactApi.sendContactMessage(subject, description, email);
            toast.success("Message sent successfully!");
            setSubject("");
            setDescription("");
            setEmail("");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to send message");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto px-6 max-w-5xl py-12">
            {!user && (
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                            <Phone className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            VoiceAI Pro
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => navigate("/")}
                        className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Button>
                </div>
            )}
            <div className="space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-primary via-purple-600 to-accent bg-clip-text text-transparent">
                        Get in Touch
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Have a question about our Voice AI solutions? Our team is here to help you scale your communications.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <Card className="lg:col-span-2 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/80 backdrop-blur-sm">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-2xl flex items-center gap-3 text-gray-900">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <MessageSquare className="w-6 h-6 text-primary" />
                                </div>
                                Send us a Message
                            </CardTitle>
                            <CardDescription>
                                We'll respond to your inquiry as quickly as possible.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    {!user && (
                                        <div className="space-y-2">
                                            <label htmlFor="email" className="text-sm font-semibold text-gray-700">
                                                Your Email
                                            </label>
                                            <Input
                                                id="email"
                                                type="email"
                                                placeholder="name@company.com"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="h-12 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white"
                                            />
                                        </div>
                                    )}
                                    <div className="space-y-2">
                                        <label htmlFor="subject" className="text-sm font-semibold text-gray-700">
                                            Subject
                                        </label>
                                        <Input
                                            id="subject"
                                            placeholder="How can we help?"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            className="h-12 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="description" className="text-sm font-semibold text-gray-700">
                                            Detailed Message
                                        </label>
                                        <Textarea
                                            id="description"
                                            placeholder="Please describe your inquiry in detail..."
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="min-h-[200px] border-gray-200 focus:border-primary focus:ring-primary/20 bg-white resize-none"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/20 group transition-all"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sending...
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span>Send Message</span>
                                            <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                        </div>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="space-y-8">
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white">
                            <CardHeader>
                                <CardTitle className="text-xl text-gray-900 font-bold">Quick Contact</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center gap-4 group cursor-pointer">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        <Mail className="w-6 h-6 text-primary group-hover:text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">Email Us</p>
                                        <p className="text-gray-600">support@voiceai.pro</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                <ShieldCheck className="w-24 h-24" />
                            </div>
                            <div className="relative z-10 space-y-4">
                                <h3 className="text-xl font-bold">Reliable Support</h3>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    Our dedicated success managers are standing by to assist with your implementation and scaling needs.
                                </p>
                                <div className="pt-2">
                                    <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 bg-white/10 rounded-full w-fit">
                                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                        Average response: &lt; 24h
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Card className="border-none bg-primary/5 shadow-none">
                            <CardContent className="p-6">
                                <p className="text-xs text-primary/80 font-medium leading-relaxed">
                                    By submitting this form, you agree to our privacy policy and consent to being contacted regarding your inquiry.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
